var mongoose = require('mongoose');

var schema = mongoose.Schema({
	game_id: String,
	room_no: Number,
	day_number: Number,
	time: String, //Day or Night
	voter: String,
	target: String
});

var vote_log = mongoose.model('vote_log', schema);

module.exports = vote_log;