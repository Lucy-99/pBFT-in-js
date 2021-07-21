import Vote from "./Vote";

class HeightVoteSet {
  height: number;
  roundVoteSets: Map<number, RoundVoteSet>;
  constructor() {
    this.height = 0;
    this.roundVoteSets = new Map();
  }
}

class RoundVoteSet {
  prevotes: VoteSet;
  precommits: VoteSet;

  constructor() {
    this.prevotes = new VoteSet();
    this.precommits = new VoteSet();
  }
}

class VoteSet {
  votes: Array<Vote>;
  constructor() {
    this.votes = [];
  }

  hasTwoThirdsAny = () => {};

  hasTwoThirdsMajority = () => {};
}
