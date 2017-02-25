var async = require('async');
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