import NodeEvent from "../interfaces/Event";

class Queue {
  private list: Array<NodeEvent>;
  constructor() {
    this.list = [];
  }
  push = (data: NodeEvent) => {
    this.list.push(data);
  };
  front = () => this.list[0];
  pop = () => {
    if (this.list.length === 0) {
      return;
    }
    this.list.shift();
  };
  size = () => this.list.length;
  show = () => {
    //console.log("queue", this.list);
  };

  isEmpty = () => this.list.length === 0;
}

export default Queue;
