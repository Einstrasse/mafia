var async =  require('async');
var db = {
	room: require(__path + 'module/db/room'),
	game: require(__path + 'module/db/game'),
	gamer: require(__path + 'module/db/gamer'),
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

global.job2kor_job = function(job) {
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

global.set_timer = function(options, callback) {
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
			socket.on('notify_death', function() {
				var room_no = socket.handshake.session.room_no;
				if (room_no) {
					socket.join(room_no + '_dead');
				}
				socket.handshake.session.is_dead = true;
				socket.handshake.session.save();
			});
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
				var is_dead = socket.handshake.session.is_dead;
				var game_id = socket.handshake.session.game_id || false;
				var job = socket.handshake.session.job || false;
				var content = msg.content;
				if (room_no) {
					if (game_id) {
						//게임중일때
						if (is_dead) {
							io.to(room_no + '_dead').emit('message', {
								username: user_id,
								content: content,
								message_type: 'dead_whisper'
							});						
						} else {
							__client.get(game_id, function (err, time) {
								if (err) throw(err)
								//'Night' -> 'Day' -> 'Vote' -> 'Defend' -> 'Final' -> 'Night'
								if (time === 'Night') {
									//밤일 경우 마피아, 경찰만 이야기 할 수 있다
									if (job === 'mafia') {
										io.to(room_no + '_mafia').emit('message', {
											username: user_id,
											content: content,
											message_type: 'mafia_whisper'
										});
									} else if (job === 'police') {
										io.to(room_no + '_police').emit('message', {
											username: user_id,
											content: content,
											message_type: 'police_whisper'
										});
									}
								} else if (time === 'Defend') {
									//최후의 변론에는 최후의 변론자만 이야기 할 수 있다.
									db.game.findOne({
										room_no: room_no,
										game_id: game_id,
										is_finished: false,
										time: 'Defend'
									}, {
										defender: 1
									}, function(err, result) {
										if (err) {
											console.log('cannot find game!');
										} else {
											if (result && result.defender && result.defender === user_id) {
												io.sockets.in(room_no.toString()).emit('message', {
													username: user_id,
													content: content,
													message_type: 'final_defend'
												});
											}
										}
									});
								} else if (time === 'Day' || time === 'Vote' || time === 'Final') {
									//낮과 투표하는 경우, 최종 찬반 투표는 모두 이야기 할 수 있다.
									io.sockets.in(room_no.toString()).emit('message', {
										username: user_id,
										content: content
									});
								}
								console.log(time)
							});
						}
					} else {
						//게임중이 아닐 때
						io.sockets.in(room_no.toString()).emit('message', {
							username: user_id,
							content: content
						});
					}
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
						db.game.findOne({
							room_no: room_no,
							is_finished: false
						}, function(err, game) {
							if (err) {
								cb(err);
							} else if (game) {
								cb('이미 게임이 진행중입니다.');
							} else {
								cb(null);
							}
						});
					},
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
						__client.set(game_id, 'Night');
						
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
							detail_type: 'game_start',
							set_time: 'night',
							set_day: 1,
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
								if (is_room_leader) {
									set_timer({
										room_no: room_no,
										io: io,
										sec: __nightLength
									}, function() {

										mod_game.go_day({
											room_no: room_no,
											game_id: game_id
										}, function(err, result) {
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
												set_time: 'day',
												msg: msg,
												type: 'game_procedure',
												detail_type: 'day',
												victim_id: revive ? '' : victim_id
											});
											
											if (result.winner) {
console.log('flag 3 - result!!:', result);
												mod_game.dump_all_job({
													room_no: room_no,
													game_id: game_id
												}, function(err, msg) {
													if (result.winner === 'mafia') {
														msg += '마피아';
													} else if (result.winner === 'civilian') {
														msg += '시민';
													} else {
														msg += result.winner;
													}
													msg += '팀이 이겼습니다.';

													io.to(room_no.toString()).emit('sys_message', {
														type: 'game_status_change',
														game_id: game_id,
														detail_type: 'game_end',
														msg: msg
													});
												});
											}
										});
									});
								}
							});
						}
					});
				} else if (msg.detail_type === 'game_end') {
					delete socket.handshake.session.game_id;
					delete socket.handshake.session.is_dead;
					delete socket.handshake.session.job;
					delete socket.handshake.session.kor_job;
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
								cb(err);
							});
						} else if (time === 'Vote') {
							db.vote_log.findOneAndUpdate({
								game_id: game_id,
								room_no: room_no,
								day_number: day_number,
								time: time,
								voter: user_id
							}, {
								target: target_id
							}, {
								upsert: true
							}, function(err, result) {
								io.to(room_no.toString()).emit('sys_message', {
									msg: target_id + ' 1표!'
								});
								cb(err);
							});
						}
					}
				], function(err, result) {
					if (err) {
						console.log('투표 실패:', err);
					}
				});
			});
			
			//exports.game_proceed = function(req, res) {
			socket.on('game_proceed', function() {
				
				var room_no = socket.handshake.session.room_no;
				var game_id = socket.handshake.session.game_id;
				var user_id = socket.handshake.session.user_id;
				var target_id;
				var day_number;

				async.waterfall([
					cb => {
						if (!game_id) {
							return cb('게임중이 아닙니다.');
						}

						mod_room.is_room_leader({
							room_no: room_no,
							user_id: user_id
						}, function(err, is_leader) {
							if (err) {
								cb(err);
							} else if (is_leader) {
								cb(null);
							} else {
								cb('방장이 아닙니다.');
							}
						});
					},
					cb => {
						db.game.findOne({
							game_id: game_id,
							room_no: room_no
						}, function(err, game_data) {
							if (err) {
								cb(err);
							} else if(game_data) {
								day_number = game_data.day_number;
								var time = game_data.time;
								if (time === 'Day') {
									__client.set(game_id, 'Vote');
									db.game.update({
										room_no: room_no,
										game_id: game_id
									}, {
										$set: {
											time: 'Vote'
										}
									}, function(err) {
										cb(err);
									});

								} else {
									cb('낮만 진행할 수 있습니다.');
								}
							} else {
								cb('게임을 찾을 수 없습니다.');
							}
						});
					},
					cb => {
						io.to(room_no.toString()).emit('sys_message', {
							type: 'game_procedure',
							detail_type: 'vote',
							set_time: 'vote',
							msg: '투표가 시작되었습니다.<br />처형할 사람을 투표해 주세요'
						});
						console.log('여기서 타이머를 다시 돌립니다.');
						set_timer({
							sec: __voteLength,
							room_no: room_no,
							io: io
						}, cb);
					},
					cb => {
						//투표로 처형할 사람 여기서 판단함
						db.vote_log.aggregate([
							{
								$match: {
									game_id: game_id,
									room_no: room_no,
									day_number: day_number,
									time: 'Vote'
								}
							}, {
								$group: {
									_id: '$target',
									count: {
										$sum: 1
									}
								}
							},
							{
								$project: {
									_id: 0,
									target: "$_id",
									count: 1
								}
							}, { 
								$sort: {
									count: -1
							}
						}], function(err, result) {
							if (err) {
								cb(err);
							} else {
								//result = [ { count: 5, target: 'user_id'}] 식으로 큰 순으로 정렬되어 나타남.
								var target = '';
								if (result.length === 1) {
									target = result[0].target;
								} else if (result.length >= 2) {
									if (result[0].target !== result[1].target) {
										target = result[0].target;
									}
								}
								target_id = target;
								cb(null);
							}
						});
					},
					cb => {
						if (target_id) {
							__client.set(game_id, 'Defend');
							db.game.update({
								game_id: game_id,
								room_no: room_no,
								day_number: day_number,
								time: 'Vote'
							}, {
								$set: {
									time: 'Defend',
									defender: target_id
								}
							}, function(err) {
								//투표로 처형할 사람이 있는 경우 최후의 반론 이후 찬반 투표를 함
								io.to(room_no.toString()).emit('sys_message', {
									type: 'game_procedure',
									detail_type: 'defend',
									set_time: 'defend',
									msg: target_id +'의 최후의 변론'
								});
								cb(err);
							});
						} else {
							//처형할 사람이 없으므로 바로 밤으로 넘어감
							cb(null);
						}
					},
					cb => {
						if (target_id) {
							set_timer({
								sec: __defendLength,
								room_no: room_no,
								io: io
							}, function() {
								__client.set(game_id, 'Final');
								db.game.update({
									game_id: game_id,
									room_no: room_no,
									day_number: day_number,
									time: 'Defend'
								}, {
									$set: {
										time: 'Final',
										defender: target_id
									}
								}, function(err) {
									if (err) {
										cb(err);
									} else {
										io.to(room_no.toString()).emit('sys_message', {
											type: 'game_procedure',
											detail_type: 'final',
											set_time: 'final',
											msg: target_id +'의 처형에 대한 최종 찬/반 투표'
										});
										set_timer({
											sec: __finalLength,
											room_no: room_no,
											io: io
										}, function() {
											cb(null);
										});
									}
								});
							});
						} else {
							//처형할 사람이 없어서 바로 밤으로 넘어감.
							cb(null);
						}
					},
					cb => {
						if (target_id) {
							//찬 반 투표의 결과 확인
							db.vote_log.aggregate([
								{
									$match: {
										game_id: game_id,
										room_no: room_no,
										day_number: day_number,
										time: 'Final',
										target: target_id
									}
								}, {
									$group: {
										_id: '$is_agree',
										count: {
											$sum: 1
										}
									}
								},
								{
									$project: {
										_id: 0,
										is_agree: "$_id",
										count: 1
									}
								}, { 
									$sort: {
										count: -1
								}
							}], function(err, result) {
								if (err) {
									cb(err);
								} else {
									// result = [{is_agree: true, count: 찬성숫자}, {is_agree: false, count: 반대숫자}];
									var agree = false;
									if (result.length === 1) {
										agree = result[0].is_agree;
									} else if (result.length >= 2) {
										if (result[0].count !== result[1].count) {
											agree = true;
										}
									}

									if (agree) {
										//여기서 처형자를 죽이는 코드가 들어간다.
										db.gamer.update({
											room_no: room_no,
											game_id: game_id,
											user_id: target_id
										}, {
											$set: {
												alive: false
											}
										}, function(err) {
											
											cb(err);
											io.to(room_no.toString()).emit('sys_message', {
												msg: target_id + '가 처형되었습니다.',
												victim_id: target_id
											});
										});
									} else {
										io.to(room_no.toString()).emit('sys_message', {
											msg: target_id + ' 처형이 기각되었습니다.'
										});
										cb(null);
									}
								}
							});
						} else {
							//처형할 사람이 없는 경우
							cb(null);
						}
					},
					cb => {
						if (target_id) {
							//게임이 끝났는지 체크
							mod_game.check_victory({
								room_no: room_no,
								game_id: game_id
							}, function(err, result) {
								if (err) {
									cb(err);
								} else {
									if (result.finished) {
										mod_game.dump_all_job({
											room_no: room_no,
											game_id: game_id
										}, function(err, msg) {
											if (result.winner === 'mafia') {
												msg += '마피아';
											} else if (result.winner === 'civilian') {
												msg += '시민';
											} else {
												msg += result.winner;
											}
											msg += '팀이 이겼습니다.';
											
											io.to(room_no.toString()).emit('sys_message', {
												type: 'game_status_change',
												game_id: game_id,
												detail_type: 'game_end',
												msg: msg
											});
											cb('game_finished');
										});
									}
								}
							});
						} else {
							//처형할 사람이 없는 경우
							cb(null);
						}
					},
					cb => {
						//여기서 다시 밤으로 돌아가는 코드가 들어간다.
						__client.set(game_id, 'Night');
						db.game.update({
							room_no: room_no,
							game_id: game_id,
							day_number: day_number,
							time: 'Final'
						}, {
							$set: {
								time: 'Night',
								defender: ''
							}
						}, function(err) {
							cb(err)
						});
					},
					cb => {
						io.sockets.in(room_no.toString()).emit('sys_message', {
							type: 'game_procedure',
							detail_type: 'night',
							set_time: 'night',
							set_day: day_number,
							msg: '밤이 되었습니다.'
						});
						set_timer({
							room_no: room_no,
							io: io,
							sec: __nightLength
						}, function() {
							//밤이 지나고 다시 낮이 되는 코드가 들어갑니다.
							mod_game.go_day({
								room_no: room_no,
								game_id: game_id
							}, function(err, result) {
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
									set_time: 'day',
									msg: msg,
									type: 'game_procedure',
									detail_type: 'day',
									victim_id: revive ? '' : victim_id
								});
console.log('flag 1 - result!!:', result);								
								if (result.winner) {
console.log('flag 2 - result!!:', result);
									mod_game.dump_all_job({
										room_no: room_no,
										game_id: game_id
									}, function(err, msg) {
										if (result.winner === 'mafia') {
											msg += '마피아';
										} else if (result.winner === 'civilian') {
											msg += '시민';
										} else {
											msg += result.winner;
										}
										msg += '팀이 이겼습니다.';

										io.to(room_no.toString()).emit('sys_message', {
											type: 'game_status_change',
											game_id: game_id,
											detail_type: 'game_end',
											msg: msg
										});
										cb('game_finished');
									});
								} else {
									cb(err);
								}
							});
						});
					}
				], function(err, result) {
					if (err && err !== 'game_finished') {
						io.sockets.in(room_no.toString()).emit('sys_message', {
							type: 'error_message',
							msg: err
						});
					} else {
						
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