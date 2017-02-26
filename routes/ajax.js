var async = require('async');
	// , session = require('express-session');
var db = {
	user: require(__path + 'module/db/user').user,
	room: require(__path + 'module/db/room').room
};

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
		(room_number, cb) => {
			var snapshot = new db.room({
				No: room_number,
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
					cb(null);
				}
			});
		},
		cb => {
			db.room.update({
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
					cb(null);
				}
			})
		}
	], function(err) {
		if (err) {
			console.log('ajax.js:create_room/', err);
			res.json({
				error: err
			});
		} else {
			res.json({
				result: true
			})
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

exports.sessChk = function(req, res) {
	console.log('session:', req.session);
	res.json(req.session);
};