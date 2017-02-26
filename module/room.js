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
	}
};