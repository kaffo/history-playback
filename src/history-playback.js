class DateTimeHelper {
	static toFriendlyKey(date) {
		return date.getTime();
	}
	
	static fromFriendlyKey(friendlyKey) {
		var newDate = new Date();
		newDate.setTime(friendlyKey);
		return newDate;
	}
}

class DummyToken extends PIXI.Container {
	constructor(data) {
		super();
		this._id = data.id;
		canvas.tokens.addChild(this);
		this.texture = PIXI.Texture.from(data.img);
		const tokenImg = new PIXI.Sprite(this.texture);
		tokenImg.height = canvas.grid.size;
		tokenImg.width = 100;
		//tokenImg.anchor.set(0.5);
		this.icon = this.addChild(tokenImg);
		this.x = data.x;
		this.y = data.y;
	}
	
	get id() {
		return this._id;
	}
	
	deleteToken() {
		canvas.tokens.removeChild(this);
	}
	
	get isDummy() {
		return true;
	}
}

//CONFIG.debug.hooks = true
class HistoryPlayback {
	static tempTokens = [];
	
	//
	// Helpers
	//
	static async getCurrentTimeObject(curScene) {
		let journalEntry = curScene.journal;
		if (journalEntry == null) {
			console.log("No Journal set on current scene");
			return {};
		}
		let currentTimeObject = await journalEntry.getFlag("history-playback","current_time")
		if (currentTimeObject == null) { currentTimeObject = {}; }
		return currentTimeObject;
	}
	
	static async getUserCurrentTime(curUser, curScene) {
		let currentTimeObject = await HistoryPlayback.getCurrentTimeObject(curScene);
		let currentTime = currentTimeObject[curUser.id];
		currentTime == null ? currentTime = new Date() : currentTime = DateTimeHelper.fromFriendlyKey(currentTime);
		return currentTime;
	}
	
	static async setUserCurrentTime(curUser, curScene, curDateTime) {
		let journalEntry = curScene.journal;
		if (journalEntry == null) {
			console.log("No Journal set on current scene");
			return;
		}
		let currentTimeObject = await HistoryPlayback.getCurrentTimeObject(curScene);
		currentTimeObject[curUser.id] = DateTimeHelper.toFriendlyKey(curDateTime);
		await journalEntry.setFlag("history-playback","current_time", $.extend(true, {}, currentTimeObject));
	}
	
	static async getHistoryObject(scene) {
		let journalEntry = scene.journal;
		if (journalEntry == null) {
			console.log("No Journal set on current scene");
			return null; 
		}
		else {
			return await journalEntry.getFlag("history-playback", "historyObject");
		}
	}
	
	static async setHistoryObject(scene, objToSet) {
		let journalEntry = scene.journal;
		if (journalEntry == null) { 
			console.log("No Journal set on current scene");
			return;
		}
		else {
			await journalEntry.setFlag("history-playback", "historyObject", $.extend(true, {}, objToSet));
		}
	}
	
	static getToken(tokenid) {
		let index = HistoryPlayback.tempTokens.findIndex((element) => element.id == tokenid);
		if (index >= 0) { return HistoryPlayback.tempTokens[index]; }
		
		let tokenIndex = canvas.tokens.placeables.findIndex((element) => element.id == tokenid);
		// 0.8 use game.viewed.tokens.entries
		if (tokenIndex >= 0) { return canvas.tokens.placeables[tokenIndex]; }
		
		return undefined;
	}
	
	static async getEarliestTime(scene) {
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
		if ( historyObject == null ) { historyObject = {}; }
		let keys = Object.keys(historyObject);
		
		keys.sort();
		if (keys.length <= 0) {
			return new Date();
		}
		
		return DateTimeHelper.fromFriendlyKey(keys[0]);
	}
	
	static async getPreviousTime(curTime, scene) {
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
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
	
	static async getLastTime(scene) {
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
		if ( historyObject == null ) { historyObject = {}; }
		let keys = Object.keys(historyObject);
		
		keys.sort();
		if (keys.length <= 0) {
			return new Date();
		}
		
		return DateTimeHelper.fromFriendlyKey(keys[keys.length - 1]);
	}
	
	static async getNextTime(curTime, scene) {
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
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
	
	static async getTimesToCull(scene) {
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
		if ( historyObject == null ) { historyObject = {}; }
		let keys = Object.keys(historyObject);
		let maxHistoryActions = await game.settings.get('history-playback', 'max-history');
		
		let returnKeys = [];
		keys.sort();
		for (var i = 0; i < keys.length - maxHistoryActions; i++) {
			returnKeys.push(DateTimeHelper.fromFriendlyKey(keys[i]));
		}
		
		return returnKeys;
	}
	
	static async renderControlPanel() {		
		let skipBackButton = `<div id="history-skip-back" class="history-control" title="Skip Back History" data-tool="skipback"><i class="fas fa-caret-left"></i><i class="fas fa-caret-left"></i></div>`;
		let stepBackButton = `<div id="history-step-back" class="history-control" title="Step Back History" data-tool="stepback"><i class="fas fa-caret-left"></i></div>`;
		let stepForwardButton = `<div id="history-step-forward" class="history-control" title="Step Back Forward" data-tool="stepforward"><i class="fas fa-caret-right"></i></div>`;
		let skipForwardButton = `<div id="history-skip-forward" class="history-control" title="Skip Forward History" data-tool="skipforward"><i class="fas fa-caret-right"></i><i class="fas fa-caret-right"></i></div>`;
		let historyButtons = `${skipBackButton}${stepBackButton}${stepForwardButton}${skipForwardButton}`;
		let historyControlDiv = `<div class="history-control-div flexrow">${historyButtons}</div>`;
		let historyTopBar = `<p class="history-status-text">Viewing Live Game<br>-</p>`;
		let historyParentDiv = $(`<div class="app history-div flexcol">${historyTopBar}${historyControlDiv}</div>`);
		$('body.vtt').append(historyParentDiv);
		$( '.history-control' ).hover(
		  function() {
			$( this ).addClass( "active" );
		  }, function() {
			$( this ).removeClass( "active" );
		  }
		);
		$('.history-control').on('click', async function () {
			await HistoryPlayback.onHistoryControlClick($(this));
		});
	}
	
	//
	// Callbacks
	//
	
	static async onAppReady() {
		HistoryPlayback.onEnableHistorySettingChange(game.settings.get('history-playback', 'enabled'));
	}
	
	static async onApplicationRender(sceneNavigation, html, data) {
		var lastUserTime = await HistoryPlayback.getUserCurrentTime(game.user, game.scenes.viewed);
		HistoryPlayback.rewindToTime(lastUserTime);
	}
	
	static async onPreTokenUpdate(scene, tokenData, delta, object, userid) {
		const curUser = game.user
		// update user's current time
		const now = new Date();
		await HistoryPlayback.setUserCurrentTime(curUser, scene, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
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
		let cullKeys = await HistoryPlayback.getTimesToCull(scene);
		cullKeys.forEach(key => delete(historyObject[DateTimeHelper.toFriendlyKey(key)]) );
		await HistoryPlayback.setHistoryObject(scene, historyObject);
	}
	
	static async onTokenCreate(scene, tokenData, options, userid) {
		const curUser = game.user
		
		// Only create if you created it
		if (curUser.id != userid) { return; }
		
		// update user's current time
		const now = new Date();
		await HistoryPlayback.setUserCurrentTime(curUser, scene, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
		if ( historyObject == null ) { historyObject = {}; }
		if (historyObject[DateTimeHelper.toFriendlyKey(now)] == null) { historyObject[DateTimeHelper.toFriendlyKey(now)] = []; }
		historyObject[DateTimeHelper.toFriendlyKey(now)].push({
			"type": "tokenCreate",
			"tokenid": tokenData._id,
			"x": tokenData.x,
			"y": tokenData.y,
			"img": tokenData.img,
			"name": tokenData.name,
			"rotation": tokenData.rotation,
			"scale": tokenData.scale,
			"width": tokenData.width,
			"height": tokenData.height,
			"effects": tokenData.effects
		});
		console.log(
			"Storing time:" + DateTimeHelper.toFriendlyKey(now) + 
			" id:" + tokenData._id + 
			" x:" + tokenData.x + 
			" y:" + tokenData.y + 
			" img:" + tokenData.img + 
			" name:" + tokenData.name + 
			" rotation:" + tokenData.rotation + 
			" scale:" + tokenData.scale + 
			" width:" + tokenData.width +
			" height:" + tokenData.height +
			" effects:" + tokenData.effects
		);
		let cullKeys = await HistoryPlayback.getTimesToCull(scene);
		cullKeys.forEach(key => delete(historyObject[DateTimeHelper.toFriendlyKey(key)]) );
		await HistoryPlayback.setHistoryObject(scene, historyObject);
	}
	
	static async onPreTokenDelete(scene, tokenData, options, userid) {
		const curUser = game.user
		// update user's current time
		const now = new Date();
		await HistoryPlayback.setUserCurrentTime(curUser, scene, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
		if ( historyObject == null ) { historyObject = {}; }
		if (historyObject[DateTimeHelper.toFriendlyKey(now)] == null) { historyObject[DateTimeHelper.toFriendlyKey(now)] = []; }
		historyObject[DateTimeHelper.toFriendlyKey(now)].push({
			"type": "tokenDelete",
			"tokenid": tokenData._id,
			"x": tokenData.x,
			"y": tokenData.y,
			"img": tokenData.img,
			"name": tokenData.name,
			"rotation": tokenData.rotation,
			"scale": tokenData.scale,
			"width": tokenData.width,
			"height": tokenData.height,
			"effects": tokenData.effects
		});
		console.log(
			"Storing time:" + DateTimeHelper.toFriendlyKey(now) + 
			" id:" + tokenData._id + 
			" x:" + tokenData.x + 
			" y:" + tokenData.y + 
			" img:" + tokenData.img + 
			" name:" + tokenData.name + 
			" rotation:" + tokenData.rotation + 
			" scale:" + tokenData.scale + 
			" width:" + tokenData.width +
			" height:" + tokenData.height +
			" effects:" + tokenData.effects
		);
		let cullKeys = await HistoryPlayback.getTimesToCull(scene);
		cullKeys.forEach(key => delete(historyObject[DateTimeHelper.toFriendlyKey(key)]) );
		await HistoryPlayback.setHistoryObject(scene, historyObject);
	}
	
	static async onCreateChatMessage(chatMessage, options, userid) {
		const curUser = game.user
		const scene = game.scenes.viewed;
		
		// Only create the message if you created it
		if (curUser.id != userid) { return; }
		
		// update user's current time
		const now = new Date();
		await HistoryPlayback.setUserCurrentTime(curUser, scene, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = await HistoryPlayback.getHistoryObject(scene);
		if ( historyObject == null ) { historyObject = {}; }
		if (historyObject[DateTimeHelper.toFriendlyKey(now)] == null) { historyObject[DateTimeHelper.toFriendlyKey(now)] = []; }
		historyObject[DateTimeHelper.toFriendlyKey(now)].push({
			"type": "chatMessage", 
			"messageid": chatMessage.id
		});
		console.log("Storing time:" + DateTimeHelper.toFriendlyKey(now) + " id:" + chatMessage.id);
		let cullKeys = await HistoryPlayback.getTimesToCull(scene);
		cullKeys.forEach(key => delete(historyObject[DateTimeHelper.toFriendlyKey(key)]) );
		await HistoryPlayback.setHistoryObject(scene, historyObject);
	}

	//
	// History Parsing
	//

	static async parseHistoryObject(curHistory, backwards = true, supressAnimations = false) {
		for (var i = 0; i < curHistory.length; i++) {
			let createDummyToken = ( curHistory[i]["type"] == "tokenDelete" && backwards ) || ( curHistory[i]["type"] == "tokenCreate" && !backwards );
			let deleteDummyToken = ( curHistory[i]["type"] == "tokenDelete" && !backwards ) || ( curHistory[i]["type"] == "tokenCreate" && backwards );
			
			if (curHistory[i]["type"] == "tokenMove") {
				let token = HistoryPlayback.getToken(curHistory[i]["tokenid"]);
				if (token !== undefined) {
					var x = backwards ? curHistory[i]["from_x"] : curHistory[i]["to_x"];
					var y = backwards ? curHistory[i]["from_y"] : curHistory[i]["to_y"];
					token.position.set(x, y);
					if (!supressAnimations) {
						canvas.animatePan({x: x, y: y, scale: Math.max(1, canvas.stage.scale.x), duration: 500});
					}
					console.log("id:" + curHistory[i]["tokenid"] + " x:" + x + " y:" + y);
				}
			} else if (curHistory[i]["type"] == "chatMessage") {
				const message = game.messages.get(curHistory[i]["messageid"]);
				if (message) {
					const token = HistoryPlayback.getToken(message.data.speaker.token);
					if ( token !== undefined) {
						if (!supressAnimations) {
							canvas.hud.bubbles.say(token, message.data.content, {
								emote: message.data.type === CONST.CHAT_MESSAGE_TYPES.EMOTE
							});
						}
						var messageHTML = $('li[data-message-id="' + message.id + '"]');
						messageHTML.addClass( "history-message-active" );
						if (messageHTML.length > 0) {
							messageHTML.get(0).scrollIntoView()
						}
					}
				}
			} else if (createDummyToken) {
				let tokenData = 
				{
					"id": curHistory[i]["tokenid"],
					"actorId": "",
					"actorLink": false,
					"bar1": {},
					"bar2": {},
					"brightLight": 0,
					"brightSight": 0,
					"dimLight": 0,
					"dimSight": 0,
					"displayBars": 0,
					"displayName": 0,
					"disposition": -1,
					"effects": curHistory[i]["effects"],
					"flags": {},
					"height": 1,
					"hidden": false,
					"img": curHistory[i]["img"],
					"lightAlpha": 1,
					"lightAngle": 360,
					"lightAnimation": {speed: 5, intensity: 5},
					"lockRotation": false,
					"name": curHistory[i]["name"],
					"randomImg": false,
					"rotation": curHistory[i]["rotation"],
					"scale": curHistory[i]["scale"],
					"sightAngle": 360,
					"tint": null,
					"vision": false,
					"width": 1,
					"x": curHistory[i]["x"],
					"y": curHistory[i]["y"]
				}
				let existingToken = HistoryPlayback.getToken(tokenData.id);
				if (existingToken !== undefined) { console.log("Token " + tokenData.id + " already exists"); return; }
				
				let token = new DummyToken(tokenData);
				HistoryPlayback.tempTokens.push(token);
				if (!supressAnimations) {
					canvas.animatePan({x: tokenData.x, y: tokenData.y, scale: Math.max(1, canvas.stage.scale.x), duration: 500});
				}
			} else if (deleteDummyToken) {
				for (var j = 0; j < HistoryPlayback.tempTokens.length; j++ ) {
					if (HistoryPlayback.tempTokens[j].id == curHistory[i]["tokenid"]) { 
						HistoryPlayback.tempTokens[j].deleteToken();
						HistoryPlayback.tempTokens.splice(j, 1);
						break; 
					}
				}
			}
		}
	}
	
	//
	// History manipluation
	//
	
	static async rewindToTime(targetTime) {
		const curUser = game.user;
		const curScene = game.scenes.viewed;
		let curTime = await HistoryPlayback.getPreviousTime(new Date(), curScene);
		let historyObject = await HistoryPlayback.getHistoryObject(curScene);
		let earliestKey = await HistoryPlayback.getEarliestTime(curScene);
		targetTime.getTime() > earliestKey.getTime() ? targetTime = targetTime : targetTime = earliestKey;
		console.log("Rewinding history to: " + targetTime.toString() );
		
		// Reset chat messages
		$('.history-message-active').removeClass( "history-message-active" );
		
		var workDone = false;
		while( targetTime.getTime() < curTime.getTime() ) {
			curTime = await HistoryPlayback.getPreviousTime(curTime, curScene);
			
			const curHistory = historyObject[DateTimeHelper.toFriendlyKey(curTime)];
			await HistoryPlayback.parseHistoryObject(curHistory, true, true);
			workDone = true;
		}
		await game.settings.set('history-playback','viewing-history', workDone);
		if (workDone) {
			targetTime.setTime(targetTime.getTime() - 1); // set time to 1ms before key
			await HistoryPlayback.setUserCurrentTime(curUser, curScene, new Date(targetTime));
		}
	}
	
	static async stepHistoryBack() {
		const curUser = game.user;
		const curScene = game.scenes.viewed;
		const currentTime = await HistoryPlayback.getUserCurrentTime(curUser, curScene);
		await game.settings.set('history-playback','viewing-history', true);
		
		// Reset chat messages
		$('.history-message-active').removeClass( "history-message-active" );
		
		var nextKey = await HistoryPlayback.getPreviousTime(currentTime, curScene);
		if (nextKey.getTime() >= currentTime.getTime()) { 
			console.log("No History to rewind");
			return; 
		} else {
			let historyObject = await HistoryPlayback.getHistoryObject(curScene);
			if ( historyObject == null ) {
				await game.settings.set('history-playback','viewing-history', false);
				return; 
			}
			const curHistory = historyObject[DateTimeHelper.toFriendlyKey(nextKey)];
			await HistoryPlayback.parseHistoryObject(curHistory, true);
			nextKey.setTime(nextKey.getTime() - 1); // set time to 1ms before key
			await HistoryPlayback.setUserCurrentTime(curUser, curScene, new Date(nextKey));
		}
	}
	
	static async fastForwardToTime(targetTime) {
		const curUser = game.user;
		const curScene = game.scenes.viewed;
		let curTime = await HistoryPlayback.getUserCurrentTime(curUser, curScene);
		let historyObject = await HistoryPlayback.getHistoryObject(curScene);
		let lastKey = await HistoryPlayback.getLastTime(curScene);
		targetTime.getTime() < lastKey.getTime() ? targetTime = targetTime : targetTime = lastKey;
		console.log("Fast Fowarding history to: " + targetTime.toString() );
		
		// Reset chat messages
		$('.history-message-active').removeClass( "history-message-active" );
		
		var workDone = false;
		while( targetTime.getTime() > curTime.getTime() ) {
			curTime = await HistoryPlayback.getNextTime(curTime, curScene);
			
			const curHistory = historyObject[DateTimeHelper.toFriendlyKey(curTime)];
			await HistoryPlayback.parseHistoryObject(curHistory, false, true);
			workDone = true;
		}
		if (workDone) {
			targetTime.setTime(targetTime.getTime() + 1); // set time to 1ms before key
			await HistoryPlayback.setUserCurrentTime(curUser, curScene, new Date(targetTime));
			await game.settings.set('history-playback','viewing-history', (targetTime.getTime() > lastKey.getTime()) );
		}
	}
	
	static async stepHistoryForward() {
		const curUser = game.user;
		const curScene = game.scenes.viewed;
		const currentTime = await HistoryPlayback.getUserCurrentTime(curUser, curScene);
		await game.settings.set('history-playback','viewing-history', true);
		
		// Reset chat messages
		$('.history-message-active').removeClass( "history-message-active" );
		
		var nextKey = await HistoryPlayback.getNextTime(currentTime, curScene);
		let historyObject = await HistoryPlayback.getHistoryObject(curScene);
		if ( historyObject == null ) {
			game.settings.set('history-playback','viewing-history', false);
			return; 
		}
		if (currentTime.getTime() >= nextKey.getTime() ) { 
			console.log("At newest point in History");
			await HistoryPlayback.setUserCurrentTime(curUser, curScene, new Date()); // Set time to now
			await game.settings.set('history-playback','viewing-history', false);
			return; 
		} else {
			const curHistory = historyObject[DateTimeHelper.toFriendlyKey(nextKey)];
			await HistoryPlayback.parseHistoryObject(curHistory, false);
			nextKey.setTime(nextKey.getTime() + 1); // set time to 1ms after key
			await HistoryPlayback.setUserCurrentTime(curUser, curScene, new Date(nextKey));
		}
	}
	
	//
	// Button/onChange callbacks
	//
	
	static async onEnableHistorySettingChange(newValue) {
		if (newValue) {
			Hooks.on('renderApplication', HistoryPlayback.onApplicationRender);
			Hooks.on('preUpdateToken', HistoryPlayback.onPreTokenUpdate);
			Hooks.on('createChatMessage', HistoryPlayback.onCreateChatMessage);
			Hooks.on('createToken', HistoryPlayback.onTokenCreate);
			Hooks.on('preDeleteToken', HistoryPlayback.onPreTokenDelete);
			HistoryPlayback.renderControlPanel();
		} else {
			Hooks.off('renderApplication', HistoryPlayback.onApplicationRender);
			Hooks.off('preUpdateToken', HistoryPlayback.onPreTokenUpdate);
			Hooks.off('createChatMessage', HistoryPlayback.onCreateChatMessage);
			Hooks.off('createToken', HistoryPlayback.onTokenCreate);
			Hooks.off('preDeleteToken', HistoryPlayback.onPreTokenDelete);
			$('.history-div').remove();
		}
	}
	
	static async onViewHistorySettingChange(newValue) {
		var settingsMessage;
		if (newValue) {
			let curUserTime = await HistoryPlayback.getUserCurrentTime(game.user, game.scenes.viewed);
			$(".history-status-text").html("Viewing Historical Game<br>" + curUserTime.toLocaleString());
			//HistoryPlayback.modifyClassOnChildren("history-no-mouse", $("body.vtt"), false);
			$("body.vtt").css("pointer-events", "none");
			let tokenRefresh = function() { };
			let tokenUpdate = function() { };
			canvas.tokens.placeables.forEach(function (token) { 
				if (token.isDummy != true) {
					token.refresh = tokenRefresh;
					token._onUpdate = tokenUpdate;
				}
			});
			settingsMessage = "Client now viewing history"
		} else {
			// Live
			$(".history-status-text").html("Viewing Live Game<br>-");
			//HistoryPlayback.modifyClassOnChildren("history-no-mouse", $("body.vtt"), true);
			$("body.vtt").css("pointer-events", "auto");
			let tokenRefresh = new Token().refresh;
			let tokenUpdate = new Token()._onUpdate;
			canvas.tokens.placeables.forEach(function (token) {
				if (token.isDummy != true) {
					token.refresh = tokenRefresh;
					token._onUpdate = tokenUpdate;
				}
			});
			settingsMessage = "Client now viewing live game";
		}
		console.log(settingsMessage);
	}
	
	static async onHistoryControlClick(clickedControl) {
		var id = clickedControl.prop('id');
		if ( id === 'history-step-back' ) {
			await HistoryPlayback.stepHistoryBack();
		} else if ( id === 'history-step-forward' ) { 
			await HistoryPlayback.stepHistoryForward();
		} else if ( id === 'history-skip-back' ) { 
			var earliestTime = await HistoryPlayback.getEarliestTime(game.scenes.viewed);
			HistoryPlayback.rewindToTime(earliestTime);
		} else if ( id === 'history-skip-forward' ) { 
			var latestTime = await HistoryPlayback.getLastTime(game.scenes.viewed);
			HistoryPlayback.fastForwardToTime(latestTime);
		}
	}
	
	
	//
	// Debug
	//
	
	static async deleteFlagOn(object, flag) {
		await object.unsetFlag("history-playback", flag);
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
}

Hooks.on('ready', HistoryPlayback.onAppReady);

Hooks.once("init", () => {
	game.settings.register('history-playback', 'enabled', {
	  name: 'Enable',
	  hint: 'Allow recording and viewing historical actions.',
	  scope: 'server',
	  config: true,
	  type: Boolean,
	  default: true,
	  onChange: async function(value) {
		await HistoryPlayback.onEnableHistorySettingChange(value);
	  }
	});
	game.settings.register('history-playback', 'viewing-history', {
	  name: 'Viewing History',
	  hint: 'The Client is currently viewing a historical game.',
	  scope: 'client',
	  config: false,
	  type: Boolean,
	  default: false,
	  onChange: async function(value) {
		await HistoryPlayback.onViewHistorySettingChange(value);
	  }
	});
	game.settings.register('history-playback', 'max-history', {
	  name: 'Max History Actions',
	  hint: 'The number of historical actions to store before deleting older actions.',
	  scope: 'server',
	  config: true,
	  type: Number,
	  default: 120
	});
});

console.log("History Playback loaded");
