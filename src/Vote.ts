interface Vote {
  height: number;
  round: number;
  nodeId: number;
  data: string | null;
}

export default Vote;
