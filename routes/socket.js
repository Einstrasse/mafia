var async =  require('async');
var db = {
	room: require(__path + 'module/db/room'),
	game: require(__path + 'module/db/game'),
	gamer: require(__path + 'module/db/gamer'),
	game_log: require(__path + 'module/db/game_log'),
	vote_log: require(__path + 'module/db/vote_log')
};

var mod_room = require(__path + 'module/room');
var mod_game = require(__path + 'module/game');

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

var job2kor_job = function(job) {
	if (job === 'mafia') {
		return '마피아';
	} else if (job === 'police') {
		return '경찰';
	} else if (job === 'doctor') {
		return '의사';
	} else {
		return '시민';
	}
};

var set_timer = function(options, callback) {
	var sec = options.sec;
	var room_no = options.room_no;
	var io = options.io;
	
	var emitting = function() {
		io.in(room_no.toString()).emit('timer', {
			left_sec: sec
		});
		sec--;
		if (sec > -1) {
			setTimeout(emitting, 1000);
		} else {
			callback();
		}
	};
	emitting();
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
				if (__roomLeftOnDisconnect) {
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
						delete socket.handshake.session.room_no;
						var user_name = user_id.split('(').shift();
						socket.handshake.session.save();
						if (data && data.joined_users) {
							var num_user = data.joined_users.length;
							io.sockets.in(room_no.toString()).emit('sys_message', {
								type: 'user_change',
								msg: user_name + '이 퇴장했습니다. 유저수:' + num_user
							});
						}
					});
				} else {
					if (user_id && room_no) {
						var user_name = user_id.split('(').shift();
						io.sockets.in(room_no.toString()).emit('sys_message', {
							type: 'error_message',
							msg: user_name + '의 접속이 끊겼습니다.'
						});
					}
					
				}
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
							// if (total_num <= mafia * 2 + 1) {
							if (false) {
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
					
					// cb => {
					// 	var snapshot = new db.game_log({
					// 		game_id: game_id,
					// 		room_no: room_no,
					// 		is_finished: false,
					// 		day_number: 1,
					// 		time: 'Night', //Day or Night
					// 		joined_users: joined_users,
					// 		vote_result: {}
					// 	});
						
					// 	snapshot.save(function(err) {
					// 		cb(err);
					// 	})
					// },
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
							detail_type: 'game_start',
							set_time: 'night',
							game_id: game_id,
							msg: '게임이 시작되었습니다.<br> 밤이 되었습니다.'
						});
					}
				});
				
			});
			
			socket.on('game_status_change', function(msg) {
				if (msg.detail_type === 'game_start') {
					var game_id = msg.game_id;
					var room_no = socket.handshake.session.room_no;
					var user_id = socket.handshake.session.user_id;
					var job = '';
					var kor_job = '';
					
					socket.handshake.session.game_id = game_id;
					async.waterfall([
						cb => {
							db.gamer.findOne({
								game_id: game_id,
								room_no: room_no,
								user_id: user_id
							}, {
								job: 1
							}, function(err, data) {
								if (err) {
									cb(err);
								} else if (data && data.job) {
									job = data.job;
									kor_job = job2kor_job(job);
									socket.handshake.session.job = job;
									socket.handshake.session.kor_job = kor_job;
									cb(null);
								} else {
									cb('cannot find gamer info');
								}
							});
						}
					], function(err, result) {
						socket.handshake.session.save();
						if (err) {
							io.sockets.in(room_no.toString()).emit('sys_message', {
								type: 'error_message',
								msg: err
							});
						} else {
							var attached_msg = '';
							if (job !== 'civilian') {
								attached_msg = '<br>왼쪽 드로어를 열어 능력을 사용할 유저를 선택하세요.';
							}
							if (job === 'mafia') {
								socket.join(room_no + '_mafia');
							} else if (job === 'police') {
								socket.join(room_no + '_police');
							}
							io.to(socket.id).emit('sys_message', {
								type: 'game_procedure',
								detail_type: 'game_start',
								job: job,
								user_id: user_id,
								msg: '당신의 직업은 ' + kor_job + '입니다.' + attached_msg
							});
							
							mod_room.is_room_leader({
								room_no: room_no,
								user_id: user_id
							}, function(err, is_room_leader) {
console.log(err, is_room_leader);
								if (is_room_leader) {
									set_timer({
										room_no: room_no,
										io: io,
										sec: __nightLength
									}, function() {

										console.log('이곳에 첫번째 밤이 끝난 뒤 낮이 되는 부분의 코드가 들어갑니다');
										mod_game.go_day({
											room_no: room_no,
											game_id: game_id
										}, function(err, result) {
		console.log('@@@', err, result);
											var victim_id = result.victim_id;
											var police_msg = result.police_msg || '조사가 이루어지지 않았습니다.';
											var revive = result.revive;
											var msg = '낮이 되었습니다.<br />';

											if (!victim_id) {
												msg += '아무일도 일어나지 않았습니다.';
											} else if (victim_id && !revive) {
												msg += victim_id + '(이)가 마피아에게 암살되었습니다.';
											} else if (victim_id && revive) {
												msg += victim_id + '(이)가 마피아의 공격을 받았지만<br />의사에 의해 살아났습니다.';
											}
											io.to(room_no + '_police').emit('sys_message', {
												msg: police_msg
											});
											io.to(room_no.toString()).emit('sys_message', {
												msg: msg
											});
										});
									});
								}
							});
						}
					});
				} else if (msg.detail_type === 'game_end') {
					delete socket.handshake.session.game_id;
					socket.handshake.session.save();
					socket.leave(room_no + '_mafia');
					socket.leave(room_no + '_police');
					socket.leave(room_no + '_dead');
				}
			});
			
			socket.on('vote', function(msg) {
				
				var room_no = socket.handshake.session.room_no;
				var user_id = socket.handshake.session.user_id;
				var game_id = socket.handshake.session.game_id;
				var job = socket.handshake.session.job;
				var target_id = msg.target_id;
				async.waterfall([
					cb => {
						db.game.findOne({
							game_id: game_id,
							room_no: room_no,
							is_finished: false
						}, {
							day_number: 1,
							time: 1
						}, function(err, data) {
							if (err) {
								cb(err);
							} else if (!data) {
								cb('cannot find game');
							} else {
								cb(null, data);
							}
						});
					},
					(data, cb) => {
						var time = data.time; //Day or Night
						var day_number = data.day_number;

						if (time === 'Night') {
							db.vote_log.findOneAndUpdate({
								game_id: game_id,
								room_no: room_no,
								day_number: day_number,
								time: time,
								voter: job
							}, {
								target: target_id
							}, {
								upsert: true
							}, function(err, result) {
								if (job === 'mafia') {
									io.to(room_no + '_mafia').emit('change_target', {
										target_id: target_id
									});
								} else if (job === 'police') {
									io.to(room_no + '_police').emit('change_target', {
										target_id: target_id
									});
								}
							});
						}
					}
				], function(err, result) {
					
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