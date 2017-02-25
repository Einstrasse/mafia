var async = require('async');
	// , session = require('express-session');
var db = {
	user: require(__path + 'module/db/user').user
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
			}, function(err, result) {
				if (err) {
					console.log('db find error');
					cb('DB 조회 에러');
				} else {
					if (result) {
						if (result.birth === req.body.birth) {
							cb(null);
						} else {
							cb('생년월일이 틀립니다.');
						}
					} else {
						cb('해당 유저가 없습니다.');
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
			res.send('login success');
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
			res.send('logout success');
		}
	});
}

exports.sessChk = function(req, res) {
	console.log('session:', req.session);
	res.json(req.session);
};