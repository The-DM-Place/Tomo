const util = require("util");

function formatTime() {
	return new Date().toLocaleString();
}

function log(level, ...args) {
	const timestamp = formatTime();
	const message = `[${timestamp}] [${level}] ${args.map(arg =>
		typeof arg === 'object' ? util.inspect(arg, { depth: 5, colors: false }) : String(arg)
	).join(' ')}\n`;
	process.stdout.write(message);
}

module.exports = {
	info: (...args) => log('INFO', ...args),
	warn: (...args) => log('WARN', ...args),
	error: (...args) => log('ERROR', ...args),
	success: (...args) => log('SUCCESS', ...args),
	debug: (...args) => log('DEBUG', ...args),
};
// this is the one