var express = require('express');
var app = express();
var http = require('http').Server(app);

var favicon = require('serve-favicon');

var path = require('path');
var fs = require('fs');
var conf = require(path.join(__dirname, 'config.js'));

var io = require('socket.io')(http);
var clients = {};

setupExpress();
setupIO();

function socketHandler(socket) {
	console.log('Client connected');
	var s = {
		id: socket.id,
		name: 'No Name',
		last_roll: -1
	};

	socket.emit('populate', clients);
	clients[socket.id] = s;

	socket.on('disconnect', () => {
		console.log("Client disconnected");
		io.emit('del_member', clients[socket.id]);
		delete clients[socket.id];
	});

	socket.on('roll', (opts) => {
		// Verify first
		if (!opts.value.match(/^[0-9]+$/) || opts.value < 1 || opts.value > 100) {
			socket.emit("present_error", "Not a valid die number");
			return;
		} else if (!opts.modifier.match(/^-?[0-9]+$/)) {
			socket.emit("present_error", "Not a valid modifier");
			return;
		} else if (!opts.times.match(/^[0-9]+$/) || opts.times < 1 || opts.times > 100) {
			socket.emit("present_error", "Not a valid amount of rolls");
			return;
		}

		var special = null;
		var rand = 0;
		for (let i = 0; i < parseInt(opts.times); ++i) {
			var roll = Math.floor(Math.random() * opts.value + 1);
			if (i === 0 && parseInt(opts.value) === 20 && roll === 20) special = "glyphicon glyphicon-star";
			if (i === 0 && parseInt(opts.value) === 20 && roll === 1) special = "glyphicon glyphicon-alert";

			rand += roll;
		}
		rand += parseInt(opts.modifier);

		console.log("Roll from: " + clients[socket.id].name + " | " + opts.value + ":" + opts.modifier + ":" + rand + ":" + opts.tooltip + ":" + parseInt(opts.times));
		io.emit('updateRoll', {value: rand, id: socket.id, tooltip: opts.tooltip, special: special});
	});

	socket.on('update_name', (name) => {
		console.log("Updating name of '" + socket.id + "': " + name);
		clients[socket.id].name = name;

		io.emit("update_name", {id: socket.id, name: name});
	});

	io.emit('new_member', s);
}

function setupExpress() {
	// Configuration
	app.set('views', path.join(__dirname, "views"));
	app.set('view engine', 'pug');

	app.use(favicon(path.join(__dirname, "public", "img", "favicon.ico")));
	app.use(express.static('public'));

	// Routes
	app.get('/', (req, res) => {
		res.render('index', {title: "DnD Stuff"});
	});

	http.listen(conf.PORT, conf.HOST, () => {
		console.log("Starting server on " + conf.HOST + ":" + conf.PORT);
	});
}

function setupIO() {
	io.on('connection', socketHandler);
}