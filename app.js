
/**
 * Module dependencies.
 */
global.__path = __dirname + '/';

var express = require('express')
  , app = express()
  , server = require('http').Server(app)
  , io = require('socket.io')(server)
  , mongoose = require('mongoose')
  , bodyParser = require('body-parser')
  , fs = require('fs')
  , path = require('path')
  , session = require('express-session')
  , cookieParser = require('cookie-parser')
  , sharedsession = require("express-socket.io-session");

// var app = express();
var port = process.env.PORT || 3000;

var global_json = JSON.parse(fs.readFileSync(__path + 'config.json'));
Object.keys(global_json).map(function(key) {
	global[key] = global_json[key];
});

var sessChk = function(needSession) {
	if (needSession) { //로그인한 상태에서만 접근 가능한 페이지
		return function(req, res, next) {
			if (req.session && req.session.user_id) {
				next();
			} else {
				res.redirect('/login');
			}
		};
	} else {
		return function(req, res, next) { //로그인 하지 않은 상태에서만 접근 가능한 페이지
			if (req.session && req.session.user_id) {
				res.redirect('/lobby');
			} else {
				next();
			}
		};
	}
};

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('MagicStrinG'));
app.use(express.static(path.join(__dirname, 'public')));

var sessionMiddleware = session({ 
	secret: 'EineKleineNachtMusik',
	resave: true, 
	saveUninitialized: true,
	cookie: { 
		maxAge: 1000 * 60 * 60 * 12, //12시간
		secure: false
	} 
});

io.use(sharedsession(sessionMiddleware, {
    autoSave: true
})); 

app.use(sessionMiddleware);
app.set('port', port);

mongoose.connect(__dbHost);

var db_conn = mongoose.connection;
db_conn.on('error', console.error.bind(console, 'connection error:'));
db_conn.once('open', function() {
  console.log('mongodb connection established successfully');
});

var routes_view = require('./routes/view')
  , routes_ajax = require('./routes/ajax')
  , routes_sock = require('./routes/socket');

app.get('/', sessChk(false), sessChk(true), routes_view.index);
app.get('/login', sessChk(false), routes_view.login);
app.get('/register', sessChk(false), routes_view.register);

app.get('/lobby', sessChk(true), routes_view.lobby);
app.get('/room', sessChk(true), routes_view.room);
// app.get('/room', routes_view.room);
//////////////////////////////////////////////////////////
app.post('/ajax/register', sessChk(false), routes_ajax.register);
app.post('/ajax/login', sessChk(false), routes_ajax.login);

app.all('/ajax/logout', sessChk(true), routes_ajax.logout);
app.post('/ajax/create_room', sessChk(true), routes_ajax.create_room);
app.get('/ajax/room_list', sessChk(true), routes_ajax.get_room_list);
app.get('/ajax/joined_user_list', sessChk(true), routes_ajax.get_joined_user_list);
app.get('/ajax/game_proceed', sessChk(true), routes_ajax.game_proceed);
app.get('/ajax/sessChk', routes_ajax.sessChk);

routes_sock.init_io(io);
global.__io = io;

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
