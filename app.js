
/**
 * Module dependencies.
 */
global.__path = __dirname + '/';

var express = require('express')
  , http = require('http')
  , mongoose = require('mongoose')
  , fs = require('fs')
  , path = require('path');

var app = express();
var port = process.env.PORT || 3000;

var global_json = JSON.parse(fs.readFileSync(__path + 'config.json'));
Object.keys(global_json).map(function(key) {
	global[key] = global_json[key];
});


app.configure(function(){
  app.set('port', port);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

mongoose.connect(__dbHost);

var db_conn = mongoose.connection;
db_conn.on('error', console.error.bind(console, 'connection error:'));
db_conn.once('open', function() {
  console.log('mongodb connection established successfully');
});

var routes_view = require('./routes/view')
  , routes_ajax = require('./routes/ajax');

app.get('/', routes_view.index);
app.get('/login', routes_view.login);
app.get('/register', routes_view.register);

app.post('/ajax/register', routes_ajax.register);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
