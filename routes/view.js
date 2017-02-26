
/*
 * GET home page.
 */

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