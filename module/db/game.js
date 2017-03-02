var mongoose = require('mongoose');

var schema = mongoose.Schema({
	game_id: String,
	room_no: Number,
	is_finished: Boolean,
	day_number: Number,
	time: String, //'Night' -> 'Day' -> 'Vote' -> 'Defend' -> 'Final' -> 'Night'
	defender: String, //최종 변론자
	joined_users: [String]
});

var game = mongoose.model('game', schema);

module.exports = game;