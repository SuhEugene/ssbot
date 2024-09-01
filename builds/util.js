const psTree = require("ps-tree");

const kill = function (pid, signal, callback) {
	signal   = signal || 'SIGKILL';
	callback = callback || function () {};
	let killTree = true;
	if(killTree) {
		psTree(pid, function (err, children) {
			[pid].concat(
				children.map(function (p) {
					return p.PID;
				})
			).forEach(function (tpid) {
				try { process.kill(tpid, signal) }
				catch (ex) { }
			});
		callback();
		});
	} else {
		try { process.kill(pid, signal) }
		catch (ex) { }
		callback();
	}
};

function checkPid(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		return false;
	}
}

function getRunningPID(proc, lock) {
	if (proc && proc.pid && checkPid(proc.pid))
		return proc.pid;

	let pid = null;
	try {
		pid = String(fs.readFileSync(lock));
	} catch (e) { console.log("Couldn't read " + lock); }

	if (pid && pid.length > 1 && checkPid(pid)) return pid;

	return false;
}


module.exports = { kill, getRunningPID };
