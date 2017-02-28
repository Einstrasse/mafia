var async = require('async');
var db = {
	user: require(__path + 'module/db/user'),
	room: require(__path + 'module/db/room')
};

module.exports = {
	join_room: function(options, callback) {
		var room_no = options.room_no;
		var user_id = options.user_id;
		
		db.room.update({
			No: room_no,
		}, {
			$addToSet: {
				joined_users: user_id
			}
		}, function(err) {
			callback(err, room_no);
		});
	},
	leave_room: function(options, callback) {
		var room_no = options.room_no;
		var user_id = options.user_id;
		async.waterfall([
			cb => {
				db.room.update({
					No: room_no
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
					No: room_no
				}, {
					joined_users: 1
				}, function(err, data) {
					cb(err, data);
				});
			}
		], function(err, result) {
			callback(err, result);
		});
	},
	is_room_leader: function(options, callback) {
		var room_no = options.room_no;
		var user_id = options.user_id;
		async.waterfall([
			cb => {
				db.room.findOne({
					No: room_no
				}, {
					leader_id: 1
				}, function(err, data) {
					if (err) {
						cb(err);
					} else if (data && data.leader_id) {
						cb(null, user_id === data.leader_id);
					} else {
						cb('cannot find room');
					}
				});
			}
		], function(err, is_leader) {
			callback(err, is_leader);
		});
	}
};