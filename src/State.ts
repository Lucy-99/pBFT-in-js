import axios from "axios";
import NodeEvent from "./Event";
import EVENT_TYPE from "./EventTypes";
import Proposal from "./Proposal";
import Queue from "./Queue";
import Timeout from "./Timeout";
import Vote from "./Vote";
import HeightVoteSet from "./VoteSet";
import VOTE_TYPE from "./VoteType";

const PEER_COUNT = 4;

const INTERVAL = 500;

const TIMEOUT_IN_MS = {
  PROPOSE: 3000,
  PROPOSE_DELTA: 500,
  PREVOTE: 1000,
  PREVOTE_DELTA: 500,
  PRECOMMIT: 1000,
  PRECOMMIT_DELTA: 500,
  COMMIT: 1000,
};

enum RoundStep {
  NewHeight = 0,
  NewRound,
  Propose,
  Prevote,
  PrevoteWait,
  Precommit,
  PrecommitWait,
  Commit,
}

class State {
  // consensus
  height: number = 0;
  round: number = 0;
  step: number = 0;

  proposal: Proposal | null = null;
  proposalBlock: number | null = null;

  lockedBlock: any;
  lockedRound: number = -1;

  validBlock: any;
  validRound: number = -1;

  //@ts-ignore
  votes: HeightVoteSet;
  // indicating my node id
  id: number;
  counter: number;

  // mutex
  locked: boolean = false;

  eventQueue: Queue;

  constructor(id: number, eventQueue: Queue) {
    this.updateToState();

    this.id = id;
    this.counter = 0;

    this.eventQueue = eventQueue;
  }

  onStart = async () => {
    setInterval(this.recvRoutine, INTERVAL);
  };

  private recvRoutine = () => {
    if (this.eventQueue.isEmpty()) return;
    let front = this.eventQueue.front();
    this.eventQueue.pop();
    switch (front.type) {
      case EVENT_TYPE.TIMEOUT:
        while (this.locked) {}
        this.locked = true;
        this.handleTimeout(front.data);
        this.locked = false;
        break;
      case EVENT_TYPE.PROPOSAL:
        while (this.locked) {}
        this.locked = true;
        this.handleProposal(front.data);
        this.locked = false;
        break;
      case EVENT_TYPE.VOTE:
        while (this.locked) {}
        this.locked = true;
        this.handleVote(front.data);
        this.locked = false;
        break;
    }
  };

  private handleProposal = (p: Proposal) => {
    console.log("handling proposal", p);
    if (p.height !== this.height || p.round !== this.round) return;
    if (p.polRound !== -1 && p.polRound >= p.round) return;
    // TODO: check proposer
    this.proposal = p;
    this.proposalBlock = p.block;

    let pvs = this.votes.prevote(this.round);
    let majority = pvs?.getTwoThirdsMajority();
    if (majority !== null && majority !== -1 && this.validRound < this.round) {
      this.validRound = this.round;
      this.validBlock = this.proposalBlock;
    }

    if (this.step <= RoundStep.Propose && this.isProposalComplete()) {
      // find proposal; goto prevote
      this.prevote(this.height, this.round);
      // majority exists; nil or block
      if (majority !== -1) this.precommit(this.height, this.round);
    }
  };

  private handleVote = (v: Vote) => {
    console.log("handling vote", v);
    if (v.height === this.height - 1 && v.type === VOTE_TYPE.PRECOMMIT) {
      return;
    }
    if (v.height !== this.height) return;
    switch (v.type) {
      case VOTE_TYPE.PREVOTE:
        let pvs = this.votes.prevote(v.round);
        if (!pvs) return;
        pvs.addVote(v);
        if (pvs.hasTwoThirdsMajority()) {
          //polka exists
          let major = pvs.getTwoThirdsMajority();
          // unlock condition
          if (
            major !== this.lockedBlock &&
            this.lockedRound < v.round &&
            v.round <= this.round
          ) {
            this.lockedBlock = null;
            this.lockedRound = -1;
          }

          // update valid
          if (major != -1 && this.validRound < v.round && v.round) {
            if (major === this.proposalBlock) {
              this.validBlock = this.proposalBlock;
              this.validRound = v.round;
            } else {
              this.proposalBlock = null;
            }
          }
        }
        // round skip: any +2/3 prevote(h, r+x)
        if (this.round < v.round && pvs.hasTwoThirdsAny()) {
          console.log("round skip by +2/3 prevote");
          this.newRound(this.height, v.round);
        } else if (this.round === v.round && this.step >= RoundStep.Prevote) {
          let major = pvs.getTwoThirdsMajority();
          // exit prevote: polka prevote
          if (major === null || (major !== -1 && this.isProposalComplete())) {
            console.log("enter precommit: +2/3 major prevote");
            pvs.showVotes();
            this.precommit(this.height, this.round);
          } else if (pvs?.hasTwoThirdsAny()) {
            // +2/3 any: wait for more prevote
            console.log("enter prevotewait: +2/3 any prevote");
            this.prevoteWait(this.height, this.round);
          }
        }

        if (
          this.proposal !== null &&
          this.proposal.polRound === v.round &&
          this.isProposalComplete()
        ) {
          this.prevote(this.height, this.round);
        }
        break;
      case VOTE_TYPE.PRECOMMIT:
        let pcs = this.votes.precommit(v.round);
        if (!pcs) return;
        pcs.addVote(v);

        if (pcs.hasTwoThirdsMajority()) {
          this.newRound(this.height, v.round);
          this.precommit(this.height, v.round);
          let major = pcs.getTwoThirdsMajority();
          if (major !== null) {
            console.log(`enter commit: +2/3 precommits`);
            pcs.showVotes();
            this.commit(this.height, v.round);
          } else {
            this.precommitWait(this.height, v.round);
          }
        } else {
          // round skip: +2/3 any precommit (h, r+x)
          if (this.round <= v.round && pcs.hasTwoThirdsAny()) {
            this.newRound(this.height, v.round);
            this.precommit(this.height, v.round);
          }
        }
        break;
      default:
        break;
    }
  };

  private handleTimeout = (ti: Timeout) => {
    console.log(`handling timeout`, ti);
    const { height, round, step } = ti;
    switch (step) {
      case RoundStep.NewHeight:
        this.newRound(height, round);
        break;
      case RoundStep.NewRound:
        this.propose(height, round);
        break;
      case RoundStep.Propose:
        this.prevote(height, round);
        break;
      case RoundStep.PrevoteWait:
        this.precommit(height, round);
        break;
      case RoundStep.PrecommitWait:
        this.precommit(height, round);
        this.newRound(height, round + 1);
        break;
    }
  };

  // new round
  newRound = (h: number, r: number) => {
    if (
      this.height !== h ||
      r < this.round ||
      (r === this.round && this.step !== RoundStep.NewHeight)
    ) {
      return;
    }
    console.log(`New round (${this.height}, ${this.round})/(${h}, ${r})`);

    if (this.round < r) {
      this.updatePriority();
    }

    this.updateRoundAndStep(r, RoundStep.NewRound);

    if (this.round !== 0) {
      this.proposal = null;
      this.proposalBlock = null;
    }

    this.votes.addRoundVoteSet(r);
    this.votes.addRoundVoteSet(r + 1);

    this.propose(h, r);
  };

  private updatePriority = () => {
    console.log(`Priority updated`);
  };

  // propose
  propose = (h: number, r: number) => {
    if (
      this.height !== h ||
      this.round > r ||
      (this.round === r && this.step >= RoundStep.Propose)
    )
      return;
    console.log(`Propose (${this.height}, ${this.round})/(${h}, ${r})`);
    this.updateRoundAndStep(r, RoundStep.Propose);

    let ti: Timeout = { height: h, round: r, step: RoundStep.Propose };
    this.scheduleTimeout(
      EVENT_TYPE.TIMEOUT,
      ti,
      TIMEOUT_IN_MS.PROPOSE + TIMEOUT_IN_MS.PROPOSE_DELTA * r
    );

    if (this.isProposer()) {
      console.log(`${this.id} is a proposer`);
      let proposal = this.decideProposal();

      this.sendToPeers("proposal", proposal);

      this.proposal = proposal;
      this.proposalBlock = proposal.block;
    }

    if (this.isProposalComplete()) {
      this.prevote(h, r);
    }
  };

  private isProposer = () => {
    return this.counter % PEER_COUNT === this.id;
  };

  private decideProposal = () => {
    let b;
    if (this.validBlock !== null) {
      console.log(`valid block in ${this.validRound}. reuse`);
      b = this.validBlock;
    } else {
      console.log(`newly created block`);
      b = this.createProposalBlock();
    }
    let p: Proposal = {
      height: this.height,
      round: this.round,
      polRound: this.validRound,
      block: b,
    };
    return p;
  };

  private createProposalBlock = () => {
    let b = Math.floor(Date.now() / 1000);
    return b;
  };

  private isProposalComplete = () => {
    if (this.proposal === null) {
      console.log(`no proposal exists`);
      return false;
    }
    // new propoal

    console.log("new proposal completed", this.proposal);
    if (this.proposal.polRound === -1) return true;
    // if not new, check if +2/3 Prevotes
    if (
      this.proposal.polRound < this.round &&
      this.votes.prevote(this.round)?.hasTwoThirdsMajority()
    )
      return true;
    return false;
  };

  // prevote
  prevote = (h: number, r: number) => {
    if (
      this.height !== h ||
      this.round > r ||
      (this.round === r && this.step >= RoundStep.Prevote)
    )
      return;
    console.log(`Prevote (${this.height}, ${this.round})/(${h}, ${r})`);
    let v: Vote = {
      height: h,
      round: r,
      nodeId: this.id,
      type: VOTE_TYPE.PREVOTE,
      data: null,
    };
    if (this.lockedBlock !== null) {
      // vote locked
      v.data = this.lockedBlock;
    } else if (!this.isValidProposal()) {
      // nil
    } else {
      // prevote proposal
      // @ts-ignore
      v.data = this.proposal.block;
    }
    this.tryAddVote(v);

    this.updateRoundAndStep(r, RoundStep.Prevote);
  };

  private isValidProposal = () => {
    if (this.proposal === null) return false;
    return true;
  };

  // prevote wait
  prevoteWait = (h: number, r: number) => {
    if (
      this.height !== h ||
      this.round > r ||
      (this.round === r && this.step >= RoundStep.PrevoteWait)
    )
      return;
    console.log(`PrevoteWait (${this.height}, ${this.round})/(${h}, ${r})`);
    let ti: Timeout = { height: h, round: r, step: RoundStep.PrevoteWait };
    this.scheduleTimeout(
      EVENT_TYPE.TIMEOUT,
      ti,
      TIMEOUT_IN_MS.PREVOTE + r * TIMEOUT_IN_MS.PREVOTE_DELTA
    );

    this.updateRoundAndStep(r, RoundStep.PrevoteWait);
  };

  // precommit
  precommit = (h: number, r: number) => {
    if (
      this.height !== h ||
      this.round > r ||
      (this.round === r && this.step >= RoundStep.Precommit)
    )
      return;
    console.log(`Precommit (${this.height}, ${this.round})/(${h}, ${r})`);

    let pvs = this.votes.prevote(r);
    if (!pvs) {
      // 일어나면 안됨
    } else {
      let v: Vote = {
        height: h,
        round: r,
        nodeId: this.id,
        type: VOTE_TYPE.PRECOMMIT,
        data: null,
      };
      let major = pvs.getTwoThirdsMajority();
      if (major === -1) {
        // precommit nil
      } else if (major === null) {
        // unlock and precommit nil
        this.lockedBlock = null;
        this.lockedRound = -1;
      } else {
        if (major === this.lockedBlock) {
          this.lockedRound = r;
          v.data = major;
        } else if (this.proposal !== null && major === this.proposal.block) {
          this.lockedBlock = this.proposal.block;
          this.lockedRound = r;
          v.data = major;
        } else {
          this.lockedBlock = null;
          this.lockedRound = -1;
        }
      }
      this.tryAddVote(v);
    }

    this.updateRoundAndStep(r, RoundStep.Precommit);
  };

  precommitWait = (h: number, r: number) => {
    if (
      this.height !== h ||
      this.round > r ||
      (this.round === r && this.step >= RoundStep.PrecommitWait)
    )
      return;
    console.log(`PrecommitWait (${this.height}, ${this.round})/(${h}, ${r})`);
    let ti: Timeout = { height: h, round: r, step: RoundStep.PrecommitWait };
    this.scheduleTimeout(
      EVENT_TYPE.TIMEOUT,
      ti,
      TIMEOUT_IN_MS.PRECOMMIT + r * TIMEOUT_IN_MS.PRECOMMIT_DELTA
    );

    this.updateRoundAndStep(r, RoundStep.PrecommitWait);
  };

  // commit
  commit = (h: number, r: number) => {
    if (
      this.height !== h ||
      this.round > r ||
      (this.round === r && this.step >= RoundStep.Commit)
    )
      return;
    console.log(`Commit (${this.height}, ${this.round})/(${h}, ${r})`);

    let pcs = this.votes.precommit(r);
    let major = pcs?.getTwoThirdsMajority() ?? null;
    if (major !== -1 && major !== null) {
      if (major === this.lockedBlock) {
        this.proposalBlock = major;
      } else this.proposalBlock = null;
    }

    if (this.proposalBlock !== null) {
      if (this.isValidBlock()) {
        console.log(`block ${this.proposalBlock} committed.`);
        this.updateToState();
        this.scheduleRound0();
      }
    }
  };

  private scheduleRound0 = () => {
    let ti: Timeout = {
      height: this.height,
      round: this.round,
      step: RoundStep.NewHeight,
    };
    this.scheduleTimeout(EVENT_TYPE.TIMEOUT, ti, TIMEOUT_IN_MS.COMMIT);
  };

  private isValidBlock = () => {
    // valdiate ...
    return true;
  };

  private updateToState = () => {
    this.height++;
    this.round = 0;
    this.step = RoundStep.NewHeight;
    this.proposal = null;
    this.proposalBlock = null;
    this.lockedBlock = null;
    this.lockedRound = -1;
    this.validBlock = null;
    this.validRound = -1;
    this.votes = new HeightVoteSet(this.height);
  };

  // utils
  private updateRoundAndStep = (r: number, step: number) => {
    this.round = r;
    this.step = step;
  };

  private scheduleTimeout = (type: string, data: any, ms: number) => {
    setTimeout(() => {
      let e: NodeEvent = { type, data };
      this.eventQueue.push(e);
    }, ms);
  };

  // adding
  private tryAddVote = (v: Vote) => {
    this.sendToPeers("vote", v);
    this.eventQueue.push({ type: "vote", data: v });
  };

  public sendToPeers = (type: string, data: any) => {
    for (let i = 0; i < PEER_COUNT; i++) {
      if (this.id === i) continue;
      let port = 8000 + i;
      axios.post(`http://localhost:${port}/${type}`, data);
    }
  };
}

export default State;
