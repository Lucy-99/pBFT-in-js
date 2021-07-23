import express from "express";
import NodeEvent from "../interfaces/Event";
import EVENT_TYPE from "../types/EventType";
import Queue from "./Queue";

class Server {
  public app: express.Application;
  port: string;
  eventQueue: Queue;
  constructor(port: string, eventQueue: Queue) {
    this.app = express();
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    this.port = port;
    this.eventQueue = eventQueue;
  }

  onStart = () => {
    this.app.post("/proposal", (req, res) => {
      let e: NodeEvent = { type: EVENT_TYPE.PROPOSAL, data: req.body };
      this.eventQueue.push(e);
      //console.log("proposal added", e.data);
      res.status(200);
      res.send("ok");
    });
    this.app.post("/vote", (req, res) => {
      let e: NodeEvent = { type: EVENT_TYPE.VOTE, data: req.body };
      this.eventQueue.push(e);
      //console.log("vote added", e.data);
      res.status(200);
      res.send("ok");
    });
    this.app.listen(this.port, () => {
      //console.log(`Server is running on ${this.port}`);
    });
  };
}

export default Server;
