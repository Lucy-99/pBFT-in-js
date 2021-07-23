interface Vote {
  height: number;
  round: number;
  nodeId: number;
  type: string;
  data: number | null;
}

export default Vote;
