import Queue from "./Queue";
import State from "./State";

const PORT = process.argv[2];
const nodeId: number = parseInt(PORT) - 8000;
let eventQueue = new Queue();
let cs = new State(nodeId, eventQueue);

cs.newRound(1, 0);


