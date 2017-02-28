var mongoose = require('mongoose');

var schema = mongoose.Schema({
	game_id: String,
	room_no: Number,
	is_finished: Boolean,
	day_number: Number,
	num_of_player: Number
});

var game_log = mongoose.model('game_log', schema);

module.exports = game_log;