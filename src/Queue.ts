class Queue {
  private list: any;
  constructor() {
    this.list = [];
  }
  push = (data: any) => {
    this.list.push(data);
  };
  front = () => this.list[0];
  pop = () => {
    if (this.list.length === 0) return;
    this.list.shift();
  };
  size = () => this.list.length;
}

export default Queue;
