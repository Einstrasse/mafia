if (localStorage.length >= 2) {
	var name = localStorage.getItem('name');
	var birth = localStorage.getItem('birth');
	
	document.getElementById('name').value = name;
	document.getElementById('birth').value = birth;
	document.getElementById('remember-me').checked = true;
}