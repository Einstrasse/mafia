var async = require('async');
var db = {
	user: require(__path + 'module/db/user'),
	room: require(__path + 'module/db/room'),
	game: require(__path + 'module/db/game'),
	gamer: require(__path + 'module/db/gamer'),
	vote_log: require(__path + 'module/db/vote_log')
};
var mod_room = require(__path + 'module/room');

exports.register = function(req, res) {
	async.waterfall([
		cb => {
			if (req.body && req.body.name && req.body.birth) {
				cb(null);
			} else {
				cb('잘못된 요청입니다.');
			}
		},
		cb => {
			if (req.body.accessToken == __accessToken) {
				cb(null);
			} else {
				cb('보안 토큰이 틀렸습니다.');
			}
		},
		cb => {
			db.user.findOne({
				name: req.body.name,
				birth: req.body.birth
			}, function(err, result) {
				if (err) {
					console.log('db find error');
					cb('DB 조회 에러');
				} else {
					if (result) {
						cb('중복된 이름과 생년월일입니다.');
					} else {
						cb(null);
					}
				}
			});
		},
		cb => {
			var snapshot = new db.user({
				name: req.body.name,
				birth: req.body.birth
			});
			snapshot.save(function(err) {
				if (err) {
					console.log('db save error');
					cb('DB 저장 에러');
				} else {
					cb(null);
				}
			});
		}
	], function(err) {
		if (err) {
			console.log('ajax.js:register/', err);
			res.send(err);
		} else {
			res.redirect('/login');
		}
	});
	
};

exports.login = function(req, res) {
	async.waterfall([
		cb => {
			if (req.body && req.body.name && req.body.birth) {
				cb(null);
			} else {
				cb('잘못된 요청입니다.');
			}
		},
		cb => {
			db.user.findOne({
				name: req.body.name,
				birth: req.body.birth
			}, function(err, result) {
				if (err) {
					console.log('db find error');
					cb('DB 조회 에러');
				} else {
					if (result) {
						cb(null);
					} else {
						cb('해당 유저가 없거나 생년월일이 틀립니다.');
					}
				}
			});
		},
		cb => {
			req.session.regenerate(function(err) {
				req.session.name = req.body.name;
				req.session.birth = req.body.birth;
				req.session.user_id = req.body.name + '(' + req.body.birth + ')';
				cb(null);
			});
		}
	], function(err) {
		if (err) {
			console.log('ajax.js:login/', err);
			res.send(err);
		} else {
			if (req.body['remember-me']) {
				res.send([
					'<script>',
						"localStorage.clear();",
						"localStorage.setItem('name','" + req.body.name + "');",
						"localStorage.setItem('birth','" + req.body.birth + "');",
						"location.href = '/lobby'",
					'</script>'
				].join(''));				
			} else {
				res.send([
					'<script>',
						"localStorage.clear();",
						"location.href = '/lobby'",
					'</script>'
				].join(''));	
			}
		}
	});	
};

exports.logout = function(req, res) {
	async.waterfall([
		cb => {
			if (req.session) {
				cb(null);
			} else {
				cb('세션이 없습니다.');
			}
		},
		cb => {
			req.session.destroy(function(err) {
				if (err) {
					console.log('session destroy errror:', err);
					cb('세션 파기 실패');
				} else {
					cb(null);
				}
			});
		}
	], function(err) {
		if (err) {
			console.log('ajax.js:logout/', err);
			res.send(err);
		} else {
			res.redirect('/login');
		}
	});
};

exports.create_room = function(req, res) {
	var room_limit_num = req.body.room_limit_num;
	
	async.waterfall([
		cb => {
			db.room.findOne({
				leader_id: req.session.user_id
			}, function(err, result) {
				if (err) {
					console.log('db.room.find Error:', err);
					cb('db 조회 에러');
				} else {
					if (result) {
						cb('이미 만든 방이 있습니다.');
					} else {
						cb(null);
					}
				}
			});
		},
		cb => {
			db.room.find().sort({No:-1}).limit(1).exec(function(err, result) {
				if (err) {
					cb('db No 조회 에러');
				} else {
					if (result && result[0] && result[0].No) {
						cb(null, result[0].No + 1);
					} else {
						cb(null, 1);
					}
				}
			});
		},
		(room_no, cb) => {
			var snapshot = new db.room({
				No: room_no,
				name: "'" + req.session.name + '"의 게임방',
				leader_id: req.session.user_id,
				max_seat: room_limit_num,
				create_time: new Date()
			});
			
			snapshot.save(function(err) {
				if (err) {
					consoloe.log('db save err:', err);
					cb('db 저장 에러');
				} else {
					cb(null, room_no);
				}
			});
		},
		(room_no, cb) => {
			mod_room.join_room({
				room_no: room_no,
				user_id: req.session.user_id
			}, function(err, room_no) {
				if (err) {
					console.log('db update err:', err);
					cb('방 참가 에러');
				} else {
					cb(null, room_no);
				}
			});
			/*
			db.room.update({
				No: room_no,
				leader_id: req.session.user_id
			}, {
				$addToSet: {
					joined_users: req.session.user_id
				}
			}, function(err) {
				if (err) {
					console.log('db update err:', err);
					cb('방 참가 에러');
				} else {
					cb(null, room_no);
				}
			});
			*/
		}
	], function(err, room_no) {
		if (err) {
			console.log('ajax.js:create_room/', err);
			res.json({
				error: err
			});
		} else {
			res.json({
				result: true,
				room_no: room_no
			});
		}
	});
};

exports.get_room_list = function(req, res) {
	async.waterfall([
		cb => {
			db.room.find({}, function(err, result) {
				if (err) {
					console.log('db find err:', err);
					cb('db 조회 에러');
				} else {
					cb(null, result);
				}
			});
		}
	], function(err, result) {
		if (err) {
			console.log('ajax.js:get_room_list error:', err);
			res.json({
				error: err
			});
		} else {
			res.json({
				result: true,
				data: result
			});
		}
	});
};

exports.get_joined_user_list = function(req, res) {
	var room_no = req.query.no;
	
	async.waterfall([
		cb => {
			db.room.findOne({
				No: room_no
			}, function(err, data) {
				if (err) {
					console.log('db조회 에러', err);
					cb('db 조회 에러');
				} else {
					if (data && data.joined_users) {
						cb(null, data.joined_users);
					} else {
						cb('방 정보가 없습니다.');
					}
				}
			});
		}
	], function(err, joined_user) {
		if (err) {
			console.log('err:', err);
			res.json({
				error: err
			});
		} else {
			res.json({
				result: true,
				data: joined_user
			});
		}
	});
};

exports.vote = function(req, res) {

	var room_no = req.session.room_no;
	var user_id = req.session.user_id;
	var game_id = req.session.game_id;
	var job = req.session.job;
	var target_id = req.query.target_id;
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
				db.gamer.findOne({
					game_id: game_id,
					room_no: room_no,
					user_id: target_id,
					alive: true
				}, function(err, gamer) {
					if (err) {
						cb(err);
					} else if (gamer) {
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
								__io.to(room_no + '_mafia').emit('change_target', {
									target_id: target_id
								});
							} else if (job === 'police') {
								__io.to(room_no + '_police').emit('change_target', {
									target_id: target_id
								});
							}
							cb(err);
						});
					} else {
						cb('사망한 사람을 지목할 수 없습니다.');
					}
				});
			} else if (time === 'Vote') {
				db.gamer.findOne({
					game_id: game_id,
					room_no: room_no,
					user_id: target_id,
					alive: true
				}, function(err, gamer) {
					if (err) {
						cb(err);
					} else if (gamer) {
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
							cb(err);
							__io.to(room_no.toString()).emit('sys_message', {
								msg: target_id + ' 1표!'
							});
						});
					} else {
						cb('사망한 사용자에게는 투표할 수 없습니다.');
					}
				});
				
			}
		}
	], function(err, result) {
		if (err) {
			console.log('투표 실패:', err);
			res.json({
				result: false,
				error: err
			});
		} else {
			res.json({
				result: true
			});
		}
	});
};

exports.game_proceed = function(req, res) {
	var room_no = req.session.room_no;
	var game_id = req.session.game_id;
	var user_id = req.session.user_id;
	
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
					var time = game_data.time;
					if (time === 'Day') {
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
			__io.to(room_no.toString()).emit('sys_message', {
				type: 'game_procedure',
				detail_type: 'vote',
				set_time: 'vote',
				msg: '투표가 시작되었습니다.<br />처형할 사람을 투표해 주세요'
			});
			console.log('여기서 타이머를 다시 돌립니다.');
		}
	], function(err, result) {
		if (err) {
			res.json({
				error: err
			});
		} else {
			res.json({
				result: true
			});
		}
	});
};

exports.sessChk = function(req, res) {
	console.log('session:', req.session);
	res.json(req.session);
};