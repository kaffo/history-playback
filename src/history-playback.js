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
	static getUserCurrentTime(curUser) {
		let currentTime = curUser.getFlag("history-playback","current_time")
		currentTime == null ? currentTime = new Date() : currentTime = DateTimeHelper.fromFriendlyKey(currentTime);
		return currentTime;
	}
	
	static setUserCurrentTime(curUser, curDateTime) {
		curUser.setFlag("history-playback","current_time", DateTimeHelper.toFriendlyKey(curDateTime));
	}
	
	static getPreviousTime(curTime, scene) {
		let historyObject = scene.getFlag("history-playback", "historyObject");
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
	
	static getNextTime(curTime, scene) {
		let historyObject = scene.getFlag("history-playback", "historyObject");
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
	
	static async onPreTokenUpdate(scene, tokenData, delta, object, userid) {
		const curUser = game.user
		// update user's current time
		const now = new Date();
		HistoryPlayback.setUserCurrentTime(curUser, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = scene.getFlag("history-playback", "historyObject");
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
		// update user's current time
		const now = new Date();
		HistoryPlayback.setUserCurrentTime(curUser, now);
		now.setTime(now.getTime() - 1); // set key 1ms in the past

		// Get and update history
		let historyObject = scene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) { historyObject = {}; }
		if (historyObject[DateTimeHelper.toFriendlyKey(now)] == null) { historyObject[DateTimeHelper.toFriendlyKey(now)] = []; }
		historyObject[DateTimeHelper.toFriendlyKey(now)].push({
			"type": "chatMessage", 
			"messageid": chatMessage.id
		});
		console.log("Storing time:" + DateTimeHelper.toFriendlyKey(now) + " id:" + chatMessage.id);
		await scene.setFlag("history-playback", "historyObject", $.extend(true, {}, historyObject));
	}

	static parseHistoryObject(curHistory) {
		for (var i = 0; i < curHistory.length; i++) {
			if (curHistory[i]["type"] == "tokenMove") {
				let tokenIndex = canvas.tokens.placeables.findIndex((element) => element.id == curHistory[i]["tokenid"]);
				if (tokenIndex >= 0) {
					// 0.8 use game.viewed.tokens.entries
					let token = canvas.tokens.placeables[tokenIndex];
					token.position.set(curHistory[i]["from_x"], curHistory[i]["from_y"]);
					console.log("id:" + curHistory[i]["tokenid"] + " x:" + curHistory[i]["from_x"] + " y:" + curHistory[i]["from_y"]);
				}
			} else if (curHistory[i]["type"] == "chatMessage") {
				const message = game.messages.get(curHistory[i]["messageid"]);
				if (message) {
					const token = canvas.tokens.get(message.data.speaker.token);
					if ( token ) canvas.hud.bubbles.say(token, message.data.content, {
						emote: message.data.type === CONST.CHAT_MESSAGE_TYPES.EMOTE
					});
				}
			}
		}
	}
	
	static stepHistoryBack() {
		const curUser = game.user;
		const currentTime = HistoryPlayback.getUserCurrentTime(curUser);
		const curScene = game.scenes.viewed;
		game.settings.set('history-playback','viewing-history', true);
		var nextKey = HistoryPlayback.getPreviousTime(currentTime, curScene);
		
		if (nextKey.getTime() >= currentTime.getTime()) { 
			HistoryPlayback.setUserCurrentTime(curUser, new Date(nextKey));
			console.log("No History to rewind");
			return; 
		}
		let historyObject = curScene.getFlag("history-playback", "historyObject");
		const curHistory = historyObject[DateTimeHelper.toFriendlyKey(nextKey)];
		HistoryPlayback.parseHistoryObject(curHistory);
		HistoryPlayback.setUserCurrentTime(curUser, new Date(nextKey));
	}
	
	static stepHistoryForward() {
		const curUser = game.user;
		const currentTime = HistoryPlayback.getUserCurrentTime(curUser);
		const curScene = game.scenes.viewed;
		game.settings.set('history-playback','viewing-history', true);
		var nextKey = HistoryPlayback.getNextTime(currentTime, curScene);
		
		if (currentTime.getTime() >= nextKey.getTime() ) { 
			console.log("At newest point in History");
			game.settings.set('history-playback','viewing-history', false);
			return; 
		}
		let historyObject = curScene.getFlag("history-playback", "historyObject");
		const curHistory = historyObject[DateTimeHelper.toFriendlyKey(nextKey)];
		HistoryPlayback.parseHistoryObject(curHistory);
		nextKey.setTime(nextKey.getTime() + 1); // set time to 1ms after key
		HistoryPlayback.setUserCurrentTime(curUser, new Date(nextKey));
	}
	
	static moveTokenLastPos(token) {
		const scene = game.scenes.viewed;
		let historyObject = scene.getFlag("history-playback", "historyObject");
		if ( historyObject == null ) { historyObject = {}; }
		let keys = Object.keys(historyObject);
		const lastHistory = historyObject[keys[0]];
		if ( token.id == lastHistory[0]["tokenid"] ) {
			let options = {"animate": false};
			//token.setPosition(lastHistory[0]["x"], lastHistory[0]["y"], options);
			//token.position.set(lastHistory[0]["x"], lastHistory[0]["y"]);
		}
	}
	
	static onViewHistorySettingChange(newValue) {
		var settingsMessage;
		if (newValue) {
			// Historical Data
			$("body.vtt").css("pointer-events", "none"); // temp hack
			settingsMessage = "Client now viewing history"
		} else {
			// Live
			$("body.vtt").css("pointer-events", "auto"); // temp hack
			settingsMessage = "Client now viewing live game";
		}
		console.log(settingsMessage);
	}
	
	static deleteFlagOn(object, flag) {
		object.unsetFlag("history-playback", flag);
	}
}

Hooks.on('ready', () => {
	Hooks.on('preUpdateToken', HistoryPlayback.onPreTokenUpdate);
	Hooks.on('createChatMessage', HistoryPlayback.onCreateChatMessage);
});

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
