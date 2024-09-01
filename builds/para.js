const child_proc = require("node:child_process");
const fs = require("node:fs");
const { getRunningPID, kill } = require("./util");


console.log("\n--- Script started", Date.now(), "---\n")

let mainProcess = null;

const { WebSocket } = require("ws");
let isWsOpen = false;
let currentWs = null;

const ID = "para";
const LOCK = `./${ID}.lock`;

const wait = (secs) => new Promise((send) => setTimeout(send, secs*1000));

function checkProcAlive() {
	if (mainProcess || !fs.existsSync(LOCK)) return;
	if (!isWsOpen) return;
	console.log("Sending late dead packet");
	try {
		fs.unlinkSync(LOCK);
		ws.send(JSON.stringify({ id: ID, type: "dead", data: null }));
	} catch (e) {}
}

function checkServerAlive() {
	if (isWsOpen) return;
	openWs();
}

setInterval(checkProcAlive, 5000);
setInterval(checkServerAlive, 5000);


function openWs() {
	const ws = new WebSocket('ws://localhost:8062');
	isWsOpen = true;
	currentWs = ws;
	setupWsListeners(ws);
	return ws;
}

function setupWsListeners(ws) {
	ws.on("open", () => {
		console.log("Sending ID", ID, "and type", "reg")
		ws.send(JSON.stringify({ id: ID, type: "reg" }));
		console.log("Registration complete");
	});
	ws.on("close", (e) => { isWsOpen = false; console.error('close', e); });
	ws.on("error", (e) => { isWsOpen = false; console.error('error', e); });


	ws.on("message", async msg => {
		if (msg == "start") {
			if (getRunningPID(mainProcess, LOCK)) return ws.send(JSON.stringify(
				{ id: ID, type: "response", data: { error: true, msg: "Сервер уже запущен" }}
			));
			//mainProcess = child_proc.spawn(`./${ID}/start.sh`, [], {
			mainProcess = child_proc.spawn(`./start.sh`, [], {
				cwd: "/root/ss13/Paradise/",
				detached: true,
				shell: true
			});
			fs.writeFileSync(LOCK, String(mainProcess.pid));
			mainProcess.on('close', (code) => {
				try { fs.unlinkSync(LOCK); } catch (e) {}
				mainProcess = null;
				if (!currentWs) return;
				console.log("Sending dead packet");
				currentWs.send(JSON.stringify({ id: ID, type: "dead", data: code }));
			});
			mainProcess.stdout.on("data", d => console.log("o", String(d)));
			mainProcess.stderr.on("data", d => console.error("e", String(d)));
			ws.send(JSON.stringify({ id: ID, type: "response", data: mainProcess.pid }));
			return;
		}
		if (msg == "stop") {
			if (!getRunningPID(mainProcess, LOCK)) return ws.send(JSON.stringify(
				{ id: ID, type: "response", data: { error: true, msg: "Сервер не запущен" }}
			));
			kill(getRunningPID(mainProcess, LOCK), 15);
			await wait(2);
			if (getRunningPID(mainProcess, LOCK)) return ws.send(JSON.stringify(
				{ id: ID, type: "response", data: { error: true, msg: "Стопнуть не вышло" }}
			));
			return ws.send(JSON.stringify({ id: ID, type: "response", data: { error: false } }));
		}
	})
}

openWs();
