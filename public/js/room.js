$(document).ready(function(){

	// var socket = io();
	window.socket = io();
	var last_sender = null;
	var avatar_type = 'identicon';
	
	var init_widget = function() {
		$('.modal').modal();

		$('ul.tabs').tabs({
			swipeable: true,
			responsiveThreshold: 400
		});

		$('.button-collapse').sideNav({
			menuWidth: 300, // Default is 300
			edge: 'left', // Choose the horizontal origin
			closeOnClick: true, // Closes side-nav on <a> clicks, useful for Angular/Meteor
			draggable: true // Choose whether you can drag to open on touch screens
		});
		$('#content').focus();
		$("form").submit( function (e) { e.preventDefault(); });
	};

	var update_user_list = function() {
		$.get('/ajax/joined_user_list', {
			no: room_no
		}, function(res) {
			var html = '';

			if (res.error) {
				alert(res.error);
			} else if (res.result) {
				var user_list = res.data;
				$('.profile').remove();
				$('#member_number').text(user_list.length.toString());

				user_list.map(function(user_id) {
					if (user_id) {
						var name = user_id.split('(').shift();
						var hash = CryptoJS.MD5(user_id).toString();
						var img_data = new Identicon(hash, 50).toString();
						var base64_user_id = btoa(encodeURIComponent(user_id));
						html += ['<li class="profile">',
							'<img class="circle profile-sm" src="data:image/png;base64,',
								img_data,
							'" data-user_id="' + base64_user_id + '">',
								'<span>' + name + '</span>',
									'<input name="playlist" type="radio" id="' + base64_user_id + '" />',
									'<label for="' + base64_user_id + '"></label>',

							'</li>'
						].join('');
					}
				});
				$('.user-list-header').after($(html));
			}
		});
	};
	
	var init_evt = function() {
		$('#game_start').click(function() {
			var mafia = $('#mafia_num').val();
			var police = $('#police_num').val();
			var doctor = $('#doctor_num').val();
			console.log('gogosing', mafia, police, doctor);
			socket.emit('game_start', {
				mafia: mafia,
				police: police,
				doctor: doctor
			});
		});
		socket.on('disconnect', function() {
			console.log('연결이 끊겼습니다.');
		});
		socket.on('connect', function() {
			console.log('재연결되었습니다.');
		});
	};
	
	init_widget();
	init_evt();
	update_user_list();
	
	function showMessage(message) {
		var avatar_box = createIdenticonAvatar( message.username );
		var who = ( $("#username").val() == message.username )? 'mine' : 'others';
		var sender_visible = ( last_sender == message.username )? 'sender-hidden' : 'sender-show';

		$('#chat').append(
			$('<div class="message">').addClass(who).addClass(sender_visible)
				.append( avatar_box )
				.append( $('<div class="text-box">')
					.append( $('<div class="username-box">' ).text( message.username ) )
					.append( $('<div class="content-box">')
						.append($('<span>').text(message.content))
					)
				)
		);
		$("#chat")[0].scrollTop = $("#chat")[0].scrollHeight;
		last_sender = message.username;
	}

	function showSysMsg (msg, option) {
		$('#chat').append(
			$('<div class="message sys-info ' + option + '">')
				.append( $('<div class="text-box">')
					.append ( $('<div class="content-box">')
						.append($('<span>').html(msg))
				)
			)
		);
		$("#chat")[0].scrollTop = $("#chat")[0].scrollHeight;
		last_sender = 'system_notice';	
	}

	// function createLetterAvatar( username ) {
	// 	var colorHash = new ColorHash({ lightness: 0.5, saturation: 0.7 });
	// 	var color = colorHash.hex( username );
	// 	var initial = username.charAt(0);
	// 	return $('<div class="avatar-box">')
	// 		.append( $('<div class="photo lavatar">').css('background', color).text(initial) );
	// }

	function createIdenticonAvatar( username ) {
		var hash = CryptoJS.MD5(username).toString();
		var img_data = new Identicon(hash, 50).toString();
		return $('<div class="avatar-box">')
			.append( $('<img class="photo">').attr('src', "data:image/png;base64," + img_data) );
	}
	
	function send() {
		var input = $('#content');
		if (!input.val()) {
			return;
		}
		socket.emit('message', {
			// 'username' : user_id,
			'content' : input.val()
		});
		input.focus();
		input.val('');
	}

	$(function () {
		
		$('#send-btn').click(function () { send(); });
		socket.emit('join_room', { 
			room_no: room_no
		});
		//debug!!
		socket.on('tt', function(a){console.log(a);});
		socket.on('message', function (message) { showMessage(message); });
		socket.on('sys_message', function (msg) { 
			showSysMsg(msg.msg, msg.type);
			if (msg.type === 'user_change') {
				update_user_list();
			}
		});
		
	});
	
	///////////////////
});