import Vote from "../interfaces/Vote";
import VOTE_TYPE from "../types/VoteType";

class HeightVoteSet {
  height: number;
  roundVoteSets: Map<number, RoundVoteSet>;

  constructor(h: number) {
    this.height = h;
    this.roundVoteSets = new Map();
    this.addRoundVoteSet(0);
  }

  addRoundVoteSet = (r: number) => {
    if (this.roundVoteSets.has(r)) return;
    this.roundVoteSets.set(r, new RoundVoteSet());
  };

  prevote = (r: number) => {
    let ret = this.roundVoteSets.get(r)?.prevotes;
    if (ret === undefined) return null;
    return ret;
  };

  precommit = (r: number) => {
    let ret = this.roundVoteSets.get(r)?.precommits;
    return ret === undefined ? null : ret;
  };
}

class RoundVoteSet {
  prevotes: VoteSet;
  precommits: VoteSet;

  constructor() {
    this.prevotes = new VoteSet();
    this.precommits = new VoteSet();
  }

  addVote = (v: Vote) => {
    switch (v.type) {
      case VOTE_TYPE.PREVOTE:
        this.prevotes.addVote(v);
        break;
      case VOTE_TYPE.PRECOMMIT:
        this.precommits.addVote(v);
        break;
    }
  };
}

class VoteSet {
  // node id is key
  votes: Map<number, Vote>;
  validators: Array<number>;
  majorBlock: number | null;
  counts: Map<number, number>;

  constructor() {
    this.votes = new Map();
    this.validators = [0, 1, 2, 3];
    this.majorBlock = -1;
    this.counts = new Map();
  }

  addVote = (v: Vote) => {
    if (this.votes.has(v.nodeId)) {
      //console.log(`vote from ${v.nodeId} already exists`);
      return;
    }
    if (!this.verifyVote(v)) return;

    //console.log(`vote from ${v.nodeId} added`, v);
    this.votes.set(v.nodeId, v);
    this.updateVoteCount(v);
  };

  verifyVote = (v: Vote) => {
    // signature check...
    return true;
  };

  updateVoteCount = (v: Vote) => {
    let ts = v.data;
    if (ts === null) return;
    if (this.counts.has(ts)) {
      // @ts-ignore
      this.counts.set(ts, this.counts.get(ts) + 1);
    } else {
      this.counts.set(ts, 1);
    }
    // @ts-ignore
    if (this.counts.get(ts) > (this.validators.length * 2) / 3) {
      this.majorBlock = ts;
    }
  };

  hasTwoThirdsAny = (): boolean => {
    return this.votes.size > (this.validators.length * 2) / 3;
  };

  hasTwoThirdsMajority = () => {
    return this.majorBlock !== -1;
  };

  getTwoThirdsMajority = () => {
    return this.majorBlock;
  };

  showVotes = () => {
    //    console.log(this.votes);
  };
}

export default HeightVoteSet;
