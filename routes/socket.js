var async =  require('async');
var db = {
	room: require(__path + 'module/db/room').room
};

var mod_room = require(__path + 'module/room');

var num_user = 0;
module.exports = {
	init_io: function(io) {
		io.on('connection', function(socket) {
			socket.on('join_room', function(msg) {
				var room_no = msg.room_no;
				async.waterfall([
					cb => {
						socket.join(room_no.toString(), cb);
					},
					cb => {
						// socket.room_no = room_no;
						socket.handshake.session.room_no = room_no;
						socket.handshake.session.save();
						db.room.findOne({
							No: room_no
						}, {
							joined_users: 1
						}, function(err, data) {
							cb(err, data);
						});
					},
					(data, cb) => {
						if (data && data.joined_users) {
							cb(null, data.joined_users.length);
						} else {
							cb('cannot find room');
						}
					}
				], function(err, num_user) {
					if (err) {
						console.log('socket:join_room err:', err);
					} else {
						io.sockets.in(room_no.toString()).emit('sys_message', '유저 한명이 새로 접속했습니다. 유저수:' + num_user);
					}
					
				});
			});
			console.log('a user connected');
			socket.on('disconnect', function() {
				var user_id = socket.handshake.session.user_id;
				var room_no = socket.handshake.session.room_no;
				if (!user_id || !room_no) {
					return;
				}
				socket.leave(room_no);
				async.waterfall([
					cb => {
						mod_room.leave_room({
							room_number: room_no,
							user_id: user_id
						}, function(err, data) {
							cb(err, data);
						});
					}
				], function(err, data) {
					if (err) {
						console.log('disconnect evt handle err');
					}
					if (data && data.joined_users) {
						var num_user = data.joined_users.length;
						io.sockets.in(room_no.toString()).emit('sys_message', '유저 한명이 퇴장했습니다. 유저수:' + num_user);
					}
				});
			});
			socket.on('message', function(msg){
				var room_no = socket.handshake.session.room_no;
				var user_id = socket.handshake.session.user_id;
				var content = msg.content;
				console.log(msg);
				io.sockets.in(room_no.toString()).emit('message', {
					username: user_id,
					content: content
				});
			});
			
			socket.on('tt', function(cmd) {
console.log('received!!:', cmd);
				try {
					socket.emit('tt', eval(cmd));
				} catch (e) {
					socket.emit('tt', e);
				}
			});
			socket.on('dd', function(val) {
				console.log(eval(val));
			});
		});
	}	
};