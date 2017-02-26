var mongoose = require('mongoose');

var schema = mongoose.Schema({
	No: 'Number',
	name: 'String',
	leader_id: 'String',
	max_seat: 'Number',
	create_time: 'Date'
});

var room = mongoose.model('room', schema);

exports.room = room;