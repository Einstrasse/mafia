var async = require('async');
var mod_room = require(__path + 'module/room');

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};

exports.login = function(req, res) {
	res.render('login');
};

exports.register = function(req, res) {
	res.render('register');
};

exports.lobby = function(req, res) {
	res.render('lobby', {
		name: req.session.name,
		birth: req.session.birth,
		user_id: req.session.user_id
	});	
};

exports.room = function(req, res) {
	var room_number = req.query.no;
	if (room_number) {
		async.waterfall([
			cb => {
				if (!req.session.user_id) {
					cb('세션이 없습니다.');
				} else {
					cb(null);
				}
			},
			cb => {
				mod_room.join_room({
					room_number: room_number,
					user_id: req.session.user_id
				}, cb);
			}
		], function(err) {
			if (err) {
				console.log('join room failed', err);
				res.send('방 참가 실패');
			} else {
				res.render('room', {
					name: req.session.name,
					birth: req.session.birth,
					user_id: req.session.user_id,
					room_no: room_number
				});
			}
		});
	} else {
		res.send('잘못된 접근법입니다.');
	}
};