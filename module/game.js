var async = require('async');
var db = {
	user: require(__path + 'module/db/user'),
	room: require(__path + 'module/db/room'),
	gamer: require(__path + 'module/db/gamer'),
	vote_log: require(__path + 'module/db/vote_log'),
	game: require(__path + 'module/db/game'),
};

module.exports = {
	go_day: function(options, callback) {
		var room_no = options.room_no;
		var game_id = options.game_id;
		
		var day_number;
		var game_data;
		var gamer_data;
		var vote_data;
		
		var response = {};
		async.waterfall([
			cb => {
				db.game.findOne({
					room_no: room_no,
					game_id: game_id
				}, function(err, data) {
					if (err) {
						 cb(err);
					} else if (data) {
						game_data = data;
						day_number = game_data.day_number;
						if (game_data.time === 'Night') {
							cb(null);
						} else {
							cb('밤이 아닙니다.');
						}
					} else {
						cb('게임 데이터를 찾을 수 없습니다.');
					}
				});
			},
			cb => {
				db.gamer.find({
					room_no: room_no,
					game_id: game_id
				}, function(err, gamers) {
					if (err) {
						cb(err);
					} else {
						gamer_data = gamers;
						cb(null);
					}
				});
			},
			cb => {
				db.vote_log.find({
					room_no: room_no,
					game_id: game_id,
					day_number: day_number,
					time: 'Night'
				}, function(err, votes) {
					if (err) {
						cb(err);
					} else {
						vote_data = votes;
						cb(null);
					}
				});
			},
			cb => {
				var police_vote_data = vote_data.find(function(item) {
					return item.voter === 'police';
				});
				
				if (police_vote_data) {
					var police_vote_target = police_vote_data.target;

					var police_target = gamer_data.find(function(item) {
						return item.user_id === police_vote_target;
					});
					var msg = police_vote_target + '는 ';
					if (police_target.job === 'mafia') {
						msg += '마피아 입니다.';
					} else {
						msg += '마피아가 아닙니다.';
					}
					response.police_msg = msg;
				}
				cb(null);
			},
			cb => {
				response.victim_id = '';
				response.revive = false;
				var doctor_target_user_id = '';
				var mafia_target_user_id = '';
				
				var doctor_vote_data = vote_data.find(function(item) {
					return item.voter === 'doctor';
				});
				if (doctor_vote_data) {
					var doctor_vote_target = doctor_vote_data.target;

					var doctor_target = gamer_data.find(function(item) {
						return item.user_id === doctor_vote_target;
					});
					if (doctor_target.alive) {
						doctor_target_user_id = doctor_target.user_id;
					}
				}
				
				var mafia_vote_data = vote_data.find(function(item) {
					return item.voter === 'mafia';
				});
				
				if (mafia_vote_data) {
					var mafia_vote_target = mafia_vote_data.target;

					var mafia_target = gamer_data.find(function(item) {
						return item.user_id === mafia_vote_target;
					});

					if (mafia_target.alive) {
						mafia_target_user_id = mafia_target.user_id;
					}
				}
				if (mafia_target_user_id) {
					response.victim_id = mafia_target_user_id;
					if (mafia_target_user_id === doctor_target_user_id) {
						response.revive = true;
					}
				}
				cb(null);
			},
			cb => {
				db.game.update({
					game_id: game_id,
					room_no: room_no,
				}, {
					$set: {
						day_number: day_number + 1,
						time: 'Day'
					}
				}, function(err, result) {
					if (err) {
						cb(err);
					} else {
						cb(null);
					}
				});
			},
			cb => {
				if (response.victim_id && !response.revive) {
					db.gamer.update({
						game_id: game_id,
						room_no: room_no,
						user_id: response.victim_id
					}, {
						$set: {
							alive: false
						}
					}, function(err, result) {
						if (err) {
							cb(err);
						} else {
							cb(null);
						}
					});
				} else {
					cb(null);
				}
			}
		], function(err) {
			callback(err, response);
		});
	}
};