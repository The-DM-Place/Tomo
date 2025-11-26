const util = require("util");

const colors = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
};

function timestamp() {
	return new Date().toLocaleString();
}

function log(level, color, ...args) {
	const prefix = `[${timestamp()}] [${level}]`;
	const formatted = args.map(arg =>
		typeof arg === "object" ? util.inspect(arg, { depth: 5, colors: false }) : String(arg)
	).join(" ");
	process.stdout.write(`${color}${prefix}${colors.reset} ${formatted}\n`);
}

module.exports = {
	info: (...a) => log("INFO", colors.blue, ...a),
	warn: (...a) => log("WARN", colors.yellow, ...a),
	error: (...a) => log("ERROR", colors.red, ...a),
	success: (...a) => log("SUCCESS", colors.green, ...a),
	debug: (...a) => log("DEBUG", colors.magenta, ...a),
};
// maybe this?