var mongoose = require('mongoose');

var schema = mongoose.Schema({
	game_id: String,
	room_no: Number,
	user_id: String,
	alive: Boolean,
	job: String,
	is_mafia_team: Boolean
});

var gamer = mongoose.model('gamer', schema);

module.exports = gamer;