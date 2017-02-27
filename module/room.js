var async = require('async');
var db = {
	user: require(__path + 'module/db/user').user,
	room: require(__path + 'module/db/room').room
};

module.exports = {
	join_room: function(options, callback) {
		var room_number = options.room_number;
		var user_id = options.user_id;
		
		db.room.update({
			No: room_number,
		}, {
			$addToSet: {
				joined_users: user_id
			}
		}, function(err) {
			callback(err, room_number);
		});
	},
	leave_room: function(options, callback) {
		var room_number = options.room_number;
		var user_id = options.user_id;
		async.waterfall([
			cb => {
				db.room.update({
					No: room_number
				}, {
					$pull: {
						joined_users: user_id
					}
				}, function(err) {
					cb(err);
				});
			},
			cb => {
				db.room.findOne({
					No: room_number
				}, {
					joined_users: 1
				}, function(err, data) {
					cb(err, data);
				});
			}
		], function(err, result) {
			callback(err, result);
		});
	}
};