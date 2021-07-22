import axios from "axios";
import Queue from "./Queue";
import Server from "./Server";
import State from "./State";

const PORT = process.argv[2];
const nodeId: number = parseInt(PORT) - 8000;

let eventQueue = new Queue();
const server = new Server(PORT, eventQueue);
server.onStart();

let cs = new State(nodeId, eventQueue);
// setTimeout(() => {
//   //axios.post("http://localhost:8000/vote", { aa: "bb" });
//   cs.sendToPeers("vote", { test: "test" });
// }, 3000);
setTimeout(() => {
  cs.onStart();
  cs.newRound(1, 0);
}, 5000);
