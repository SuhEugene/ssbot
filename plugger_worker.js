const { parentPort, workerData } = require('worker_threads');
const plugger = require('./plugger');

const { avaHash, userUrl } = workerData;

const generate = async (avaHash, userUrl) => parentPort.postMessage({ filepath: await plugger(avaHash, userUrl) });
generate(avaHash, userUrl);
