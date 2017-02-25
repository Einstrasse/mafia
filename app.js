
/**
 * Module dependencies.
 */

var express = require('express')
  , routes_view = require('./routes/view')
  , routes_ajax = require('./routes/ajax')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

var app = express();
var port = process.env.PORT || 3000;

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

app.get('/', routes_view.index);
app.get('/users', user.list);
app.get('/login', routes_view.login);
app.get('/register', routes_view.register);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
