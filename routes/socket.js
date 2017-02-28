var async =  require('async');
var db = {
	room: require(__path + 'module/db/room'),
	game: require(__path + 'module/db/game'),
	gamer: require(__path + 'module/db/gamer'),
	game_log: require(__path + 'module/db/game_log')
};

var mod_room = require(__path + 'module/room');

var rand_string = function(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    for( var i=0; i < len; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

var lottery = function(arr, nums) {
	var jobs = Object.keys(nums);
	var ret = {};
	jobs.map(function(job) {
		var N = nums[job];
		ret[job] = [];
		for (var i = 0; i < N; i++) {
			var idx = parseInt(Math.random() * arr.length, 10);
			ret[job].push(arr[idx]);
			arr.splice(idx, 1);
		}
	});
	return ret;
};

// var num_user = 0;
module.exports = {
	init_io: function(io) {
		io.on('connection', function(socket) {
			socket.on('join_room', function(msg) {
				var room_no = msg.room_no;
				var user_id = socket.handshake.session.user_id;
				var user_name = user_id.split('(').shift();
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
						io.sockets.in(room_no.toString()).emit('sys_message', {
							type: 'user_change',
							msg: user_name + '이 새로 접속했습니다. 유저수:' + num_user
						});
					}
					
				});
			});
			console.log('a user connected');
			socket.on('disconnect', function() {
				var user_id = socket.handshake.session.user_id;
				var room_no = socket.handshake.session.room_no;
				if (user_id && room_no) {
					var user_name = user_id.split('(').shift();
					io.sockets.in(room_no.toString()).emit('sys_message', {
						type: 'error_message',
						msg: user_name + '의 접속이 끊겼습니다.'
					});
				}
				//////
				/*
				var user_id = socket.handshake.session.user_id;
				var room_no = socket.handshake.session.room_no;
				if (!user_id || !room_no) {
					return;
				}
				socket.leave(room_no);
				async.waterfall([
					cb => {
						mod_room.leave_room({
							room_no: room_no,
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
						io.sockets.in(room_no.toString()).emit('sys_message', {
							type: 'user_change',
							msg: '유저 한명이 퇴장했습니다. 유저수:' + num_user
						});
					}
				});
				*/
				/////
			});
			socket.on('message', function(msg){
				var room_no = socket.handshake.session.room_no;
				var user_id = socket.handshake.session.user_id;
				var content = msg.content;
				if (room_no) {
					io.sockets.in(room_no.toString()).emit('message', {
						username: user_id,
						content: content
					});
				}
			});
			
			socket.on('game_start', function(msg) {
				var room_no = socket.handshake.session.room_no;
				var user_id = socket.handshake.session.user_id;
				var mafia = parseInt(msg.mafia, 10);
				var police = parseInt(msg.police, 10);
				var doctor = parseInt(msg.doctor, 10);
				var game_id = 'game_' + rand_string(10);
				var joined_users = [];
				
				async.waterfall([
					cb => {
						mod_room.is_room_leader({
							room_no: room_no,
							user_id: user_id
						}, cb);
					},
					(is_room_leader, cb) => {
						if (is_room_leader) {
							db.room.findOne({
								No: room_no
							}, cb);
						} else {
							cb('방장이 아닙니다.');
						}
					},
					(room_data, cb) => {
						if (room_data && room_data.joined_users) {
							var total_num = room_data.joined_users.length;
							joined_users = room_data.joined_users;
							if (total_num <= mafia * 2 + 1) {
								cb('마피아 수가 너무 많습니다');
							} else if (total_num <= (mafia + police + doctor)) {
								cb('직업 수가 너무 많습니다.');
								
							} else {
								cb(null);
							}
						} else {
							cb('방 정보를 찾을 수 없습니다.');
						}
					},
					cb => {
						
						var snapshot = new db.game({
							game_id: game_id,
							room_no: room_no,
							is_finished: false,
							day_number: 1,
							time: 'Night',
							joined_users: joined_users
						});
						
						snapshot.save(function(err) {
							cb(err);
						});
					},
					cb => {
						var lot_result = lottery(joined_users, {
							mafia: mafia,
							police: police,
							doctor: doctor
						});
						async.parallel([
							p_cb => {
								async.map(lot_result.mafia,
								  (user_id, m_cb) => {
									var snapshot = new db.gamer({
										game_id: game_id,
										room_no: room_no,
										user_id: user_id,
										alive: true,
										job: 'mafia',
										is_mafia_team: true
									});
									snapshot.save(function(err) {
										m_cb(err);
									});
								}, function(err) {
									p_cb(err);
								});
							},
							p_cb => {
								async.map(lot_result.police,
								  (user_id, m_cb) => {
									var snapshot = new db.gamer({
										game_id: game_id,
										room_no: room_no,
										user_id: user_id,
										alive: true,
										job: 'police',
										is_mafia_team: false
									});
									snapshot.save(function(err) {
										m_cb(err);
									});
								}, function(err) {
									p_cb(err);
								});
							},
							p_cb => {
								async.map(lot_result.doctor,
								  (user_id, m_cb) => {
									var snapshot = new db.gamer({
										game_id: game_id,
										room_no: room_no,
										user_id: user_id,
										alive: true,
										job: 'doctor',
										is_mafia_team: false
									});
									snapshot.save(function(err) {
										m_cb(err);
									});
								}, function(err) {
									p_cb(err);
								});
							},
							p_cb => {
								async.map(joined_users,
								  (user_id, m_cb) => {
									var snapshot = new db.gamer({
										game_id: game_id,
										room_no: room_no,
										user_id: user_id,
										alive: true,
										job: 'civilian',
										is_mafia_team: false
									});
									snapshot.save(function(err) {
										m_cb(err);
									});
								}, function(err) {
									p_cb(err);
								});
							}
						], function(err) {
							cb(null);
						});
					}
				], function(err) {
					if (err) {
						io.sockets.in(room_no.toString()).emit('sys_message', {
							type: 'error_message',
							msg: err
						});
					} else {
						io.sockets.in(room_no.toString()).emit('sys_message', {
							type: 'game_status_change',
							game_id: game_id,
							msg: '게임이 시작되었습니다.<br> 밤이 되었습니다.'
						});
					}
				});
				
			});
			
			//////////////////
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