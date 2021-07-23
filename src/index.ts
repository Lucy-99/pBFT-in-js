import Queue from "./classes/Queue";
import Server from "./classes/Server";
import State from "./classes/State";

const PORT = process.argv[2];
const nodeId: number = parseInt(PORT) - 8000;

let eventQueue = new Queue();
const server = new Server(PORT, eventQueue);
server.onStart();

let cs = new State(nodeId, eventQueue);

setTimeout(() => {
  cs.onStart();
  cs.newRound(1, 0);
}, 5000);
