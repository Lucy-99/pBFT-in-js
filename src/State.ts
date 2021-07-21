import NodeEvent from "./Event";
import Proposal from "./Proposal";
import Queue from "./Queue";

const PEER_COUNT = 4;
const TIMEOUT_IN_MS = {
  PROPOSE: 3000,
  PROPOSE_DELTA: 500,
  PREVOTE: 1000,
  PREVOTE_DELTA: 500,
};

class State {
  // consensus
  height: number;
  round: number;
  step: number;

  proposal: Proposal | null;

  lockedBlock: any;
  lockedRound: number;

  validBlock: any;
  validRound: number;

  votes: any;
  // indicating my node id
  id: number;
  counter: number;

  eventQueue: Queue;

  constructor(id: number, eventQueue: Queue) {
    this.height = 1;
    this.round = 0;
    this.step = 0;
    this.proposal = null;
    this.lockedBlock = null;
    this.lockedRound = -1;
    this.validBlock = null;
    this.validRound = -1;

    this.id = id;
    this.counter = 0;

    this.eventQueue = eventQueue;
  }

  // new round
  newRound = (h: number, r: number) => {
    console.log(`New round (${this.height}, ${this.round})/(${h}, ${r})`);
    if (this.round < r) {
      this.updatePriority();
    }
    if (this.round !== 0) {
      this.proposal = null;
    }
    this.propose(h, r);
  };

  private updatePriority = () => {
    console.log(`Priority updated`);
  };

  // propose
  propose = (h: number, r: number) => {
    console.log(`Propose (${this.height}, ${this.round})/(${h}, ${r})`);

    setTimeout(() => {
      let e: NodeEvent = { type: "timeout" };
      this.eventQueue.push(e);
    }, TIMEOUT_IN_MS.PROPOSE + TIMEOUT_IN_MS.PROPOSE_DELTA * r);

    if (this.isProposer()) {
      console.log(`${this.id} is a proposer`);
      let proposal = this.decideProposal();
      this.proposal = proposal;
      // broadcast
    }
    if (this.isProposalComplete()) {
      this.prevote(h, r);
    }
  };

  private isProposer = () => {
    return this.counter % PEER_COUNT === this.id;
  };

  private decideProposal = () => {
    if (this.validBlock !== null) {
      console.log(`proposal in ${this.validRound}. reuse`);
      return this.validBlock;
    }
    return this.makeNewProposal();
  };

  private makeNewProposal = () => {
    console.log(`make new proposal`);
    return 1;
  };

  private isProposalComplete = () => {
    if (this.proposal === null) {
      console.log(`no proposal exists`);
      return false;
    }
    // new propoal
    if (this.proposal.polRound === -1) return true;
    // if not new, check if +2/3 Prevotes
    return false;
  };

  // prevote
  prevote = (h: number, r: number) => {
    if (this.lockedBlock !== null) {
      // vote locked
    } else if (!this.isValidProposal()) {
      // nil
    } else {
      // prevote proposal
    }
  };

  private isValidProposal = () => {
    if (this.proposal === null) return false;
    return true;
  };

  // prevote wait
  prevoteWait = (h: number, r: number) => {
    this.scheduleTimeout(
      "prevoteWait",
      TIMEOUT_IN_MS.PREVOTE + r * TIMEOUT_IN_MS.PREVOTE_DELTA
    );
  };

  // precommit
    precommit = (h: number, r: number) => {
      
    }
    
    
    
  private scheduleTimeout = (type: string, ms: number) => {
    setTimeout(() => {}, ms);
  };
}

export default State;
