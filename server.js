/* jshint node: true */
// Server.js
// ---------
// Node.js script to run the backend server and listen for both express requests
// and SOcket.IO messages
var express = require('express');
var app = express();
var http = require('http').Server(app);

var favicon = require('serve-favicon');

var path = require('path');
var conf = require(path.join(__dirname, 'config.js'));

var io = require('socket.io')(http);
var clients = {};

setupExpress();
setupIO();

// Sets up the socket message handlers for both listening and emitting
// - socket: socket.io | The socket to respond to
function socketHandler(socket) {
	console.log('Client connected');
	var s = {
		id: socket.id,
		name: 'No Name',
		last_roll: -1
	};

	// Populate the list of clients first and then add the new member (avoids doubling new user)
	socket.emit('populate', clients);
	clients[socket.id] = s;

	// Remove a user from all connected users on disconnect of client
	socket.on('disconnect', () => {
		console.log("Client disconnected");

		// Verify that user was connected before
		if (!clients.hasOwnProperty(socket.id)) {
			console.log("ERROR: Specified user was not connected");
			socket.emit("present_error", "Specified user was not previously connected");
		} else {
			io.emit('del_member', clients[socket.id]);
			delete clients[socket.id];
		}
	});

	// Generates a random roll with the specified options
	// - opts: JSON | List of options
	//   - value: String | Number of die sides (upper random limit)
	//   - modifier: String | Extra modifier to add (or subtract) from the final roll
	//   - times: String | Number of times to roll the die
	//   - tooltip: String | Tooltip to display on the user
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

	// Updates a user's name
	socket.on('update_name', (name) => {
		console.log("Updating name of '" + socket.id + "': " + name);
		clients[socket.id].name = name;

		io.emit("update_name", {id: socket.id, name: name});
	});

	// Alert all users of the new user
	io.emit('new_member', s);
}

// Configures express and all of its routes
function setupExpress() {
	// Use pug as the rendering engine
	app.set('views', path.join(__dirname, "views"));
	app.set('view engine', 'pug');

	// Set up the middleware (favicon for serving favicons and setting the public folder as static)
	app.use(favicon(path.join(__dirname, "public", "img", "favicon.ico")));
	app.use(express.static('public'));

	// Routes
	app.get('/', (req, res) => {
		res.render('index', {title: "DnD Roller"});
	});

	http.listen(conf.PORT, conf.HOST, () => {
		console.log("Starting server on " + conf.HOST + ":" + conf.PORT);
	});
}

// Setup socket
function setupIO() {
	io.on('connection', socketHandler);
}