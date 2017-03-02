var async = require('async');
var mod_room = require(__path + 'module/room');
var db = {
	user: require(__path + 'module/db/user'),
	room: require(__path + 'module/db/room'),
	gamer: require(__path + 'module/db/gamer'),
	vote_log: require(__path + 'module/db/vote_log'),
	game: require(__path + 'module/db/game'),
};

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
	var user_id = req.session.user_id;
	var room_no = req.session.room_no;
	if (user_id && room_no) {
		var user_name = user_id.split('(').shift();
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
				__io.sockets.in(room_no.toString()).emit('sys_message', {
					type: 'user_change',
					msg: user_name + '이 퇴장했습니다. 유저수:' + num_user
				});
			}
		});
	}
	res.render('lobby', {
		name: req.session.name,
		birth: req.session.birth,
		user_id: req.session.user_id
	});	
};

exports.room = function(req, res) {
	var room_no = req.query.no;
	var user_id = req.session.user_id;
	var is_room_leader = false;
	if (room_no) {
		async.waterfall([
			cb => {
				if (!req.session.user_id) {
					cb('세션이 없습니다.');
				} else {
					req.session.room_no = room_no;
					cb(null);
				}
			},
			cb => {
				db.game.findOne({
					room_no: room_no,
					is_finished: false
				}, function(err, data) {
					if (err) {
						cb(err);
					} else if (data) {
						cb('이미 게임중인 방입니다.');
					} else {
						cb(null);
					}
				});
			},
			cb => {
				mod_room.join_room({
					room_no: room_no,
					user_id: user_id
				}, function(err) {
					cb(err);
				});
			},
			cb => {
				mod_room.is_room_leader({
					room_no: room_no,
					user_id: user_id
				}, function(err, leader) {
					is_room_leader = leader;
					cb(err);
				});
			}
		], function(err) {
			if (err) {
				console.log('join room failed', err);
				res.send('방 참가 실패' + err);
			} else {
				res.render('room', {
					name: req.session.name,
					birth: req.session.birth,
					user_id: user_id,
					room_no: room_no,
					is_room_leader: is_room_leader
				});
			}
		});
	} else {
		res.send('잘못된 접근법입니다.');
	}
};