var mongoose = require('mongoose');

var schema = mongoose.Schema({
	name: 'String',
	birth: 'String'
});

var user = mongoose.model('user', schema);

module.exports = user;