$(() => {
	var socket = io();
	var timeouts = {};
	var shortcuts = {};
	var delete_shortcut = false;

	if (window.localStorage.shortcuts) 
		shortcuts = JSON.parse(window.localStorage.shortcuts);

	for (var s in shortcuts) {
		var opts = shortcuts[s];
		appendShortcut(opts);
	}

	$("#roll").click(() => {
		sendRoll();
	});

	$("#add-shortcut").click(() => {
		var menu = $("#add-shortcut-menu");
		$("span", "#add-shortcut").toggleClass("glyphicon-plus");
		$("span", "#add-shortcut").toggleClass("glyphicon-remove");

		if (menu.is(":visible")) {
			menu.slideUp();
		} else {
			menu.slideDown();
		}
	});

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

	$("#append-shortcut").click(() => {
		var opts = {
			name: $("#short-name").val() || "No Name",
			mod: $("#short-mod").val() || "0",
			die: $("#short-die").val() || "20"
		};

		if (shortcuts.hasOwnProperty(opts.name)) {
			$("#number").html("That shortcut already exists");
		} else {
			shortcuts[opts.name] = opts;
			window.localStorage.shortcuts = JSON.stringify(shortcuts);
			appendShortcut(opts);

			$("#short-name").val("");
			$("#short-mod").val("");
			$("#short-die").val("");
		}
	});

	socket.on('connect', () => {
		setTimeout(() => {
			$("#client-" + socket.id).addClass("active clickable");
			$("#client-" + socket.id).click(() => {
				$("#client-" + socket.id + "-input").val($("#client-" + socket.id + "-name").html());
				toggleName(socket.id);
			});

			if (window.localStorage.name) {
				$("#client-" + socket.id + "-name").html(window.localStorage.name);
				socket.emit("update_name", window.localStorage.name);
			}
		}, 250);
	});

	socket.on('populate', (clients) => {
		$.each(clients, function (key, data) {
			addMem(data.id, data.name);
		});
	});

	socket.on('updateRoll', (opts) => {
		console.log("Updating roll: ", opts);
		$("#client-" + opts.id + "-badge").html(opts.value);

		if (socket.id === opts.id) {
			$("#number").html(opts.value);
		}

		if (timeouts[opts.id]) clearTimeout(timeouts[opts.id]);
		timeouts[opts.id] = setTimeout(() => {
			console.log("Clearing badge: " + "#client-" + socket.id + "-badge");
			$("#client-" + opts.id + "-badge").html("");
		}, 30 * 1000);
	});

	socket.on('new_member', (client) => {
		addMem(client.id, client.name);
	});

	socket.on('del_member', (client) => {
		$('#client-' + client.id).remove();
	});

	socket.on('update_name', (opts) => {
		console.log("Updating name: ", opts);
		$('#client-' + opts.id + "-name").html(opts.name);
	});

	function addMem(id, name) {
		$('<a id="client-' + id +'" class="inverse list-group-item">' + 
			'<span class="badge" id="client-' + id + '-badge"></span><span id="client-' + id + '-name">' + name + '</span></a>' +
			'<input type="text" id="client-' + id + '-input" class="form-control">'
		).hide().appendTo("#users").slideDown();

		$("#client-" + id + "-input").hide();

		$('#client-' + id + '-input').keyup(function (event) {
			shouldSubmit(id, event);
		});
	};

	function sendRoll(opts) {
		opts = opts || {};
		var mod = opts.mod || $('#roll-modifier-input').val() || "0";
		var val = opts.die || $('#roll-input').val();
		if (!val.match(/^[0-9]+$/) || val < 1 || val > 100) {
			$("#number").html("Not a valid die number");
		} else if (!mod.match(/^(-)?[0-9]+$/)) {
			$("#number").html("Not a valid modifier");
		} else {
			socket.emit('roll', {value: val, modifier: mod});
		}
	}

	function toggleName(id) {
		$("#client-" + id).toggle();
		$("#client-" + id + "-input").toggle();
	}

	function updateName(id) {
		window.localStorage.name = $("#client-" + id + "-input").val();
		socket.emit("update_name", $("#client-" + id + "-input").val());
	}

	function shouldSubmit(id, event) {
		event.which = event.which || event.keyCode;
		if (event.which === 13) {
			updateName(id);
			toggleName(id);
		}
	}

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
});