class DateTimeHelper {
	static toFriendlyKey(date) {
		return date.getTime();//date.toJSON().replace('.','$');
	}
	
	static fromFriendlyKey(friendlyKey) {
		var newDate = new Date();
		newDate.setTime(friendlyKey);
		return newDate;
	}
}

//CONFIG.debug.hooks = true
class HistoryPlayback {
	static async getUserCurrentTime(curUser) {
		let currentTime = await curUser.getFlag("history-playback","current_time")
		currentTime == null ? currentTime = new Date() : currentTime = DateTimeHelper.fromFriendlyKey(currentTime);
		return currentTime;
	}
	
	static async setUserCurrentTime(curUser, curDateTime) {
		await curUser.setFlag("history-playback","current_time", DateTimeHelper.toFriendlyKey(curDateTime));
	}
	
	static async getEarliestTime(scene) {
		let historyObject = await scene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) { historyObject = {}; }
		let keys = Object.keys(historyObject);
		
		keys.sort();
		if (keys.length <= 0) {
			return curTime;
		}
		
		return DateTimeHelper.fromFriendlyKey(keys[0]);
	}
	
	static async getPreviousTime(curTime, scene) {
		let historyObject = await scene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) { historyObject = {}; }
		let keys = Object.keys(historyObject);
		
		keys.sort();
		if (keys.length <= 0) {
			return curTime;
		}
		
		var previousKey = curTime;
		for(var i = keys.length - 1; i >= 0; i--) {
			previousKey = DateTimeHelper.fromFriendlyKey(keys[i]);
			if (previousKey < curTime) {
				break;
			}
		}
		//console.log(curTime + " " + previousKey);
		return previousKey;
	}
	
	static async getNextTime(curTime, scene) {
		let historyObject = await scene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) { historyObject = {}; }
		let keys = Object.keys(historyObject);
		
		keys.sort();
		if (keys.length <= 0) {
			return curTime;
		}
		
		var nextKey = curTime;
		for(var i = 0; i < keys.length; i++) {
			nextKey = DateTimeHelper.fromFriendlyKey(keys[i]);
			if (nextKey > curTime) {
				break;
			}
		}
		//console.log(curTime + " " + previousKey);
		return nextKey;
	}
	
	static async onAppReady() {
		Hooks.on('preUpdateToken', HistoryPlayback.onPreTokenUpdate);
		Hooks.on('createChatMessage', HistoryPlayback.onCreateChatMessage);
		
		var lastUserTime = await HistoryPlayback.getUserCurrentTime(game.user)
		HistoryPlayback.rewindToTime(lastUserTime);
		let stepBackButton = `<div id="history-step-back" class="history-control" title="Step Back History" data-tool="stepback"><i class="fas fa-caret-left"></i></div>`;
		let stepForwardButton = `<div id="history-step-forward" class="history-control" title="Step Back Forward" data-tool="stepback"><i class="fas fa-caret-right"></i></div>`;
		let historyButtons = `${stepBackButton}${stepForwardButton}`;
		let historyControlDiv = `<div class="history-control-div flexrow">${historyButtons}</div>`;
		let historyTopBar = `<p class="history-status-text">Viewing Live Game</p>`;
		let historyParentDiv = $(`<div class="app history-div flexcol">${historyTopBar}${historyControlDiv}</div>`);
		$('body.vtt').append(historyParentDiv);
		$( '.history-control' ).hover(
		  function() {
			$( this ).addClass( "active" );
		  }, function() {
			$( this ).removeClass( "active" );
		  }
		);
		$('.history-control').on('click', function () {
			HistoryPlayback.onHistoryControlClick($(this));
		});
	}
	
	static async onPreTokenUpdate(scene, tokenData, delta, object, userid) {
		const curUser = game.user
		// update user's current time
		const now = new Date();
		await HistoryPlayback.setUserCurrentTime(curUser, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = await scene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) { historyObject = {}; }
		if (historyObject[DateTimeHelper.toFriendlyKey(now)] == null) { historyObject[DateTimeHelper.toFriendlyKey(now)] = []; }
		historyObject[DateTimeHelper.toFriendlyKey(now)].push({
			"type": "tokenMove", 
			"tokenid": tokenData._id, 
			"from_x": tokenData.x, 
			"from_y": tokenData.y,
			"to_x": delta["x"] != null ? delta["x"] : tokenData.x, 
			"to_y": delta["y"] != null ? delta["y"] : tokenData.y 
		});
		console.log("Storing time:" + DateTimeHelper.toFriendlyKey(now) + " id:" + tokenData._id + " x:" + tokenData.x + " y:" + tokenData.y);
		await scene.setFlag("history-playback", "historyObject", $.extend(true, {}, historyObject));
	}
	
	static async onCreateChatMessage(chatMessage, options, userid) {
		const curUser = game.user
		const scene = game.scenes.viewed;
		
		// Only create the message if you created it
		if (curUser.id != userid) { return; }
		
		// update user's current time
		const now = new Date();
		await HistoryPlayback.setUserCurrentTime(curUser, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = await scene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) { historyObject = {}; }
		if (historyObject[DateTimeHelper.toFriendlyKey(now)] == null) { historyObject[DateTimeHelper.toFriendlyKey(now)] = []; }
		historyObject[DateTimeHelper.toFriendlyKey(now)].push({
			"type": "chatMessage", 
			"messageid": chatMessage.id
		});
		console.log("Storing time:" + DateTimeHelper.toFriendlyKey(now) + " id:" + chatMessage.id);
		await scene.setFlag("history-playback", "historyObject", $.extend(true, {}, historyObject));
	}

	static parseHistoryObject(curHistory, backwards = true) {
		for (var i = 0; i < curHistory.length; i++) {
			if (curHistory[i]["type"] == "tokenMove") {
				let tokenIndex = canvas.tokens.placeables.findIndex((element) => element.id == curHistory[i]["tokenid"]);
				if (tokenIndex >= 0) {
					// 0.8 use game.viewed.tokens.entries
					let token = canvas.tokens.placeables[tokenIndex];
					var x;
					var y;
					backwards ? x = curHistory[i]["from_x"] : x = curHistory[i]["to_x"];
					backwards ? y = curHistory[i]["from_y"] : y = curHistory[i]["to_y"];
					token.position.set(x, y);
					canvas.animatePan({x: x, y: y, scale: Math.max(1, canvas.stage.scale.x), duration: 500});
					console.log("id:" + curHistory[i]["tokenid"] + " x:" + x + " y:" + y);
				}
			} else if (curHistory[i]["type"] == "chatMessage") {
				const message = game.messages.get(curHistory[i]["messageid"]);
				if (message) {
					const token = canvas.tokens.get(message.data.speaker.token);
					if ( token ) {
						canvas.hud.bubbles.say(token, message.data.content, {
							emote: message.data.type === CONST.CHAT_MESSAGE_TYPES.EMOTE
						});
						$('li[data-message-id="' + message.id + '"]').addClass( "history-message-active" );
					}
					
				}
			}
		}
	}
	
	static async rewindToTime(targetTime) {
		const curUser = game.user;
		const curScene = game.scenes.viewed;
		let curTime = await HistoryPlayback.getPreviousTime(new Date(), curScene);;
		let historyObject = await curScene.getFlag("history-playback", "historyObject");
		let earliestKey = await HistoryPlayback.getEarliestTime(curScene);
		targetTime.getTime() > earliestKey.getTime() ? targetTime = targetTime : targetTime = earliestKey;
		console.log("Rewinding history to: " + targetTime.toString() );
		
		var workDone = false;
		while( targetTime.getTime() < curTime.getTime() ) {
			curTime = await HistoryPlayback.getPreviousTime(curTime, curScene);
			
			const curHistory = historyObject[DateTimeHelper.toFriendlyKey(curTime)];
			HistoryPlayback.parseHistoryObject(curHistory, true);
			if (curHistory[0]["type"] == "tokenMove") {
				var token = canvas.tokens.get(curHistory[0]["tokenid"]);
			}
			workDone = true;
		}
		await game.settings.set('history-playback','viewing-history', workDone);
	}
	
	static async stepHistoryBack() {
		const curUser = game.user;
		const currentTime = await HistoryPlayback.getUserCurrentTime(curUser);
		const curScene = game.scenes.viewed;
		await game.settings.set('history-playback','viewing-history', true);
		
		// Reset chat messages
		$('.history-message-active').removeClass( "history-message-active" );
		
		var nextKey = await HistoryPlayback.getPreviousTime(currentTime, curScene);
		if (nextKey.getTime() >= currentTime.getTime()) { 
			console.log("No History to rewind");
			return; 
		} else {
			let historyObject = await curScene.getFlag("history-playback", "historyObject");
			if ( historyObject == null ) {
				await game.settings.set('history-playback','viewing-history', false);
				return; 
			}
			const curHistory = historyObject[DateTimeHelper.toFriendlyKey(nextKey)];
			HistoryPlayback.parseHistoryObject(curHistory, true);
			nextKey.setTime(nextKey.getTime() - 1); // set time to 1ms before key
			await HistoryPlayback.setUserCurrentTime(curUser, new Date(nextKey));
		}
	}
	
	static async stepHistoryForward() {
		const curUser = game.user;
		const currentTime = await HistoryPlayback.getUserCurrentTime(curUser);
		const curScene = game.scenes.viewed;
		await game.settings.set('history-playback','viewing-history', true);
		
		// Reset chat messages
		$('.history-message-active').removeClass( "history-message-active" );
		
		var nextKey = await HistoryPlayback.getNextTime(currentTime, curScene);
		let historyObject = await curScene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) {
			game.settings.set('history-playback','viewing-history', false);
			return; 
		}
		if (currentTime.getTime() >= nextKey.getTime() ) { 
			console.log("At newest point in History");
			await HistoryPlayback.setUserCurrentTime(curUser, new Date()); // Set time to now
			await game.settings.set('history-playback','viewing-history', false);
			return; 
		} else {
			const curHistory = historyObject[DateTimeHelper.toFriendlyKey(nextKey)];
			HistoryPlayback.parseHistoryObject(curHistory, false);
			nextKey.setTime(nextKey.getTime() + 1); // set time to 1ms after key
			await HistoryPlayback.setUserCurrentTime(curUser, new Date(nextKey));
		}
	}
	
	static modifyClassOnChildren(classToAdd, item, removeClass = false) {
		removeClass ? item.removeClass(classToAdd) : item.addClass(classToAdd);
		var children = item.children();
		if (children.length > 0) {
			children.each(function () {
				HistoryPlayback.modifyClassOnChildren(classToAdd, $(this), removeClass);
			});
		}
	}
	
	static onViewHistorySettingChange(newValue) {
		var settingsMessage;
		if (newValue) {
			$(".history-status-text").text("Viewing Historical Game");
			//HistoryPlayback.modifyClassOnChildren("history-no-mouse", $("body.vtt"), false);
			$("body.vtt").css("pointer-events", "none");
			let tokenRefresh = function() { };
			let tokenUpdate = function() { };
			canvas.tokens.placeables.forEach(function (token) { token.refresh = tokenRefresh; token._onUpdate = tokenUpdate });
			settingsMessage = "Client now viewing history"
		} else {
			// Live
			$(".history-status-text").text("Viewing Live Game");
			//HistoryPlayback.modifyClassOnChildren("history-no-mouse", $("body.vtt"), true);
			$("body.vtt").css("pointer-events", "auto");
			let tokenRefresh = new Token().refresh;
			let tokenUpdate = new Token()._onUpdate;
			canvas.tokens.placeables.forEach(function (token) { token.refresh = tokenRefresh; token._onUpdate = tokenUpdate });
			settingsMessage = "Client now viewing live game";
		}
		console.log(settingsMessage);
	}
	
	static onHistoryControlClick(clickedControl) {
		var id = clickedControl.prop('id');
		if ( id === 'history-step-back' ) {
			HistoryPlayback.stepHistoryBack();
		} else if ( id === 'history-step-forward' ) { 
			HistoryPlayback.stepHistoryForward();
		}
	}
	
	static async deleteFlagOn(object, flag) {
		await object.unsetFlag("history-playback", flag);
	}
}

Hooks.on('ready', HistoryPlayback.onAppReady);

Hooks.once("init", () => {
	game.settings.register('history-playback', 'viewing-history', {
	  name: 'Viewing History',
	  hint: 'The Client is currently viewing a historical game.',
	  scope: 'client',
	  config: false,
	  type: Boolean,
	  default: false,
	  onChange: value => {
		HistoryPlayback.onViewHistorySettingChange(value);
	  }
	});
});

console.log("History Playback loaded");
