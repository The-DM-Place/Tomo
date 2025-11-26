const util = require("util");

// testing bc pterodactyl is a bitch <3
const supportsColor = process.stdout && process.stdout.isTTY;

const colors = supportsColor
	? {
		reset: "\x1b[0m",
		red: "\x1b[31m",
		green: "\x1b[32m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
		magenta: "\x1b[35m",
		cyan: "\x1b[36m",
		white: "\x1b[37m",
	  }
	: {
		reset: "",
		red: "",
		green: "",
		yellow: "",
		blue: "",
		magenta: "",
		cyan: "",
		white: "",
	  };

function timestamp() {
	return new Date().toLocaleString();
}

function log(level, color, ...args) {
	const prefix = `[${timestamp()}] [${level}]`;

	const formatted =
		args.length === 1 && typeof args[0] === "object"
			? util.inspect(args[0], { depth: 5, colors: false })
			: args.map(x => String(x)).join(" ");

	console.log(`${color}${prefix}${colors.reset} ${formatted}`);
}

module.exports = {
	info: (...a) => log("INFO", colors.blue, ...a),
	warn: (...a) => log("WARN", colors.yellow, ...a),
	error: (...a) => log("ERROR", colors.red, ...a),
	success: (...a) => log("SUCCESS", colors.green, ...a),
	debug: (...a) => log("DEBUG", colors.magenta, ...a),
};
