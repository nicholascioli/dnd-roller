var express = require('express');
var app = express();
var http = require('http').Server(app);

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

	socket.on('roll', (die) => {
		console.log("Roll from: " + clients[socket.id].name + " | " + die);
		io.emit('updateRoll', {value: Math.floor(Math.random() * die + 1), id: socket.id});
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