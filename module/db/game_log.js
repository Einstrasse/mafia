var mongoose = require('mongoose');

var schema = mongoose.Schema({
	game_id: String,
	room_no: Number,
	is_finished: Boolean,
	day_number: Number,
	time: String, //Day or Night
	joined_users: [String],
	vote_result: Object
});

var game_log = mongoose.model('game_log', schema);

module.exports = game_log;