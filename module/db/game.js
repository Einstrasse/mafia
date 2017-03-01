var mongoose = require('mongoose');

var schema = mongoose.Schema({
	game_id: String,
	room_no: Number,
	is_finished: Boolean,
	day_number: Number,
	time: String, //'Night' -> 'Day' -> 'Vote' -> 'Final' -> 'Night'
	joined_users: [String]
});

var game = mongoose.model('game', schema);

module.exports = game;