var mongoose = require('mongoose');

var schema = mongoose.Schema({
	game_id: String,
	room_no: Number,
	day_number: Number,
	time: String, //Vote or Night
	voter: String,
	target: String,
	is_agree: Boolean
});

var vote_log = mongoose.model('vote_log', schema);

module.exports = vote_log;