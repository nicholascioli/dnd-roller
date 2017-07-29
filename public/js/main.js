/* jshint browser: true */
/* global $, io */

// Main.js
// -------
// This is the main controlling logic for the front end.
// Responsible for listening and emitting socket.io messages
// and dynamically changing the page based on those messages.

// Operate in JQuery land for its fancy animations and ease of use
$(() => {
	// Constants
	const BADGE_TIMEOUT = 30 * 1000;
	const ERROR_TIMEOUT = 3 * 1000;

	var socket = io();
	var timeouts = {};
	var shortcuts = {};
	var delete_shortcut = false;

	// Store personal preferences in the web browser's localstorage
	if (window.localStorage.shortcuts) 
		shortcuts = JSON.parse(window.localStorage.shortcuts);

	for (var s in shortcuts) {
		var opts = shortcuts[s];
		appendShortcut(opts);
	}

	// -- On Click listeners for the different buttons --
	$("#roll").click(() => {
		sendRoll();
	});

	// Toggles visibility of the shortcut menu
	$("#add-shortcut").click(() => {
		var menu = $("#add-shortcut-menu");

		if (menu.is(":visible")) {
			menu.slideUp(() => {
				$("span", "#add-shortcut").toggleClass("glyphicon-plus");
				$("span", "#add-shortcut").toggleClass("glyphicon-remove");
			});
		} else {
			menu.slideDown(() => {
				$("span", "#add-shortcut").toggleClass("glyphicon-plus");
				$("span", "#add-shortcut").toggleClass("glyphicon-remove");
			});
		}
	});

	// Toggles between using shortcuts and removing shortcuts on click
	$("#remove-shortcut").click(() => {
		$("span", "#remove-shortcut").toggleClass("glyphicon-minus");
		$("span", "#remove-shortcut").toggleClass("glyphicon-remove");

		$.each($("#shortcuts"), function (i, item) {
			$("button", item).each(function () {
				$(this).toggleClass("btn-info");
				$(this).toggleClass("btn-warning");
			});
		});

		delete_shortcut = !delete_shortcut;
	});

	// Responsible for saving the shortcut to the localstorage and adding it to
	// the user's shortcut bar
	$("#append-shortcut").click(() => {
		// Use the values provided or set defaults
		var opts = {
			name: $("#short-name").val() || "No Name",
			mod: $("#short-mod").val() || "0",
			times: $('#short-times').val() || "1",
			die: $("#short-die").val() || "20",
			tool: $("#short-name").val() || ""
		};

		// If the shortcut hasn't been created already, add it. Otherwise, alert
		// the user that the shortcut exists already
		if (shortcuts.hasOwnProperty(opts.name)) {
			error("That shortcut already exists");
		} else {
			shortcuts[opts.name] = opts;
			window.localStorage.shortcuts = JSON.stringify(shortcuts);
			appendShortcut(opts);

			$("#short-name").val("");
			$("#short-mod").val("");
			$("#short-times").val("");
			$("#short-die").val("");
		}
	});

	// -- Socket.IO handlers
	// Handle making the user's name clickable and highlighted on connection
	socket.on('connect', () => {
		setTimeout(() => {
			$("#client-" + socket.id).addClass("active clickable");
			$("#client-" + socket.id).click(() => {
				$("#client-" + socket.id + "-input").val($("#client-" + socket.id + "-name").html());
				toggleName(socket.id);
			});

			// If the user has set a name previously, update their name on all
			// active connections
			if (window.localStorage.name) {
				$("#client-" + socket.id + "-name").html(window.localStorage.name);
				socket.emit("update_name", window.localStorage.name);
			}
		}, 250);
	});

	// Populates the list of users connected
	socket.on('populate', (clients) => {
		$.each(clients, function (key, data) {
			addMem(data.id, data.name);
		});
	});

	// Updates the roll value for any connected user. This includes:
	// - Updating the badge next to the user's name
	// - Updating the tooltip on the user to display the name of their shortcut used
	// - Displaying a special symbol next to the value rolled on either a 1 or 20 on a d20
	socket.on('updateRoll', (opts) => {
		$("#client-" + opts.id + "-badge").html(opts.value).hide().fadeIn();
		$('#client-' + opts.id).tooltip('destroy');

		// If the user has rolled a special value (either a 20 or a 1 on a d20)
		// display a special symbol next to the value rolled
		if (opts.special !== null) {
			$("#client-" + opts.id + "-badge").append(" <span class=\"" + opts.special + "\"></span>");
		}
		
		// Update the tooltip
		setTimeout(() => $('#client-' + opts.id).tooltip({
			title: opts.tooltip
		}), 250);

		// If the rolled value is for the current user, update the user's display
		if (socket.id === opts.id) {
			$("#number").html(opts.value + " ");
			$("#number-special").attr("class", opts.special || "");
		}

		// Delete the badge after a configurable amount of time
		if (timeouts[opts.id]) clearTimeout(timeouts[opts.id]);
		timeouts[opts.id] = setTimeout(() => {
			$("#client-" + opts.id + "-badge").fadeOut(function () {$(this).html("");});
		}, BADGE_TIMEOUT);
	});

	socket.on('new_member', (client) => {
		addMem(client.id, client.name);
	});

	socket.on('del_member', (client) => {
		$('#client-' + client.id).remove();
	});

	socket.on('update_name', (opts) => {
		$('#client-' + opts.id + "-name").html(opts.name);
	});

	socket.on('present_error', (msg) => {
		error(msg);
	});

	// -- Helper functions --
	// Adds a member to the list of users
	// - id: Integer | Unique socket ID
	// - name: String | Display name of the user
	function addMem(id, name) {
		$('<a id="client-' + id +'" class="inverse list-group-item" data-toggle="tooltip" data-placement="left" title="">' + 
			'<span class="badge" id="client-' + id + '-badge"></span><span id="client-' + id + '-name">' + name + '</span></a>' +
			'<input type="text" id="client-' + id + '-input" class="form-control">'
		).hide().appendTo("#users").slideDown();

		$("#client-" + id + "-input").hide();

		$('#client-' + id + '-input').keyup(function (event) {
			shouldSubmit(id, event);
		});
	}

	// Sends a roll request to the server
	// - opts: JSON | List of options to pass
	//   - mod: String | Modifier to apply after the roll
	//   - die: String | How many sides are on the die
	//   - tip: String | The tooltip to display
	//   - times: String | How many times to roll
	function sendRoll(opts) {
		opts = opts || {};
		var mod = opts.mod || $('#roll-modifier-input').val() || "0";
		var val = opts.die || $('#roll-input').val();
		var tip = opts.tool || "Regular Roll";
		var times = opts.times || $('#roll-times').val() || "1";

		socket.emit('roll', {value: val, modifier: mod, tooltip: tip, times: times});
	}

	// Toggles between diplaying the username and allowing the user to change it
	function toggleName(id) {
		$("#client-" + id).toggle();
		$("#client-" + id + "-input").toggle();
	}

	// Send a user's new name to the server
	function updateName(id) {
		window.localStorage.name = $("#client-" + id + "-input").val();
		socket.emit("update_name", $("#client-" + id + "-input").val());
	}

	// Handler to check if the user's name should be updated
	function shouldSubmit(id, event) {
		event.which = event.which || event.keyCode;
		if (event.which === 13) {
			updateName(id);
			toggleName(id);
		}
	}

	// Add a shortcut to the user's shortcut bar
	// - opts: JSON | List of options to pass
	//   - name: String | Name of the shortcut
	//   - Refer to sendRoll for a list of the other options
	function appendShortcut(opts) {
		var b = $("<button class='btn btn-info' id='btn-" + opts.name + "'>" + opts.name + "</button>");
		b.click(() => {
			if (delete_shortcut) {
				b.remove();
				delete shortcuts[opts.name];

				window.localStorage.shortcuts = JSON.stringify(shortcuts);
			} else {
				sendRoll(opts);
			}
		});
		b.appendTo("#shortcuts");
	}

	// Shows an error message to the user in the form of a notification bar
	// msg: String | The error message to display
	function error(msg) {
		$("<div class=\"alert alert-danger alert-dismissible\" role=\"alert\">" +
			"<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
			"<span aria-hidden=\"true\">&times;</span></button>" +
			"<strong>Error!</strong> " + msg + "</div>"
		).prependTo("#alerts").hide().slideDown().delay(ERROR_TIMEOUT).slideUp(function () {$(this).remove();});
	}
});