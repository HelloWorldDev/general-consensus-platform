'use strict';

const Node = require('./node');
const config = require('../config');

class DEXONNode extends Node {

    extendVectors(v, n, type) {
        const a = [];
        for (let nodeID in this.decides) {
            const msg = this.decides[nodeID];
            if (msg.round <= v.length) {
                a.push({
                    type: type,
                    value: msg.value,
                    sender: msg.sender,
                    round: msg.round
                });
            }
        }
        for (let i = 0; i < n; i++) {
            v.push(a);
        }
    }

    updateLock(round) {
        let r = this.getMaxResult(this.precommits[round]);
        //this.logger.warning([`${this.lock.round} ${this.round} ${round}`]);
        if (r.count >= 2 * this.f + 1 && r.value !== 'SKIP') {
            this.lock.value = r.value;
            this.lock.round = round;
            if (round > this.round) {
                //this.round = round + 1;
                this.round = round;
                // directly jump to next round step 2
                this.step = 2;
                clearTimeout(this.clock);
                this.runBALogic();
            }
            /*
            else {
                this.round = this.round + 1;
            }*/
            return true;
        }
        return false;
    }

    forwardNextRound(round) {
        if (this.commits[round].length >= 2 * this.f + 1) {
            this.round = round + 1;
            this.step = 2;
            clearTimeout(this.clock);
            this.runBALogic();
            return true;
        }
        return false;
    }

    decide(round) {
        let r = this.getMaxResult(this.commits[round]);
        if (r.count >= 2 * this.f + 1 && r.value !== 'SKIP') {
            this.logger.info([`decides on ${r.value} in round ${this.round}`]);
            this.send(this.nodeID, 'broadcast', {
                type: 'decide',
                value: r.value,
                sender: this.nodeID,
                round: this.round
            });
            this.decidedValue = r.value;
            this.isDecided = true;
            //process.exit(0);
            return true;
        }
        return false;
    }

    getMaxResult(roundData) {
        if (roundData === undefined || roundData.length === 0) {
            return { value: undefined, count: 0 };
        }
        return roundData.groupBy(msg => msg.value)
            // [[value, [msg]], [value, [msg]]]
            .map(e => ({ value: e[0], count: e[1].length }))
            // [{value: v, count: 1}, {value: v, count: 2}]
            .maxBy(e => e.count);
            // {value: v, count: max}
    }

    runBALogic() {
        // extend precommits and commits to current round
        if (this.round > this.precommits.length - 1) {
            this.extendVectors(this.precommits,
                this.round - this.precommits.length + 1,
                'precommit'
            );
        }
        if (this.round > this.commits.length - 1) {
            this.extendVectors(this.commits,
                this.round - this.commits.length + 1,
                'commit'
            );
        }
        if (this.step === 2) {
            if (this.lock.value === undefined) {
                // find best leader value
                const bestValue = this.values
                    .map(msg => parseInt(msg.value))
                    .min();
                const msg = {
                    type: 'precommit',
                    value: '' + bestValue,
                    sender: this.nodeID,
                    round: this.round
                };
                this.precommits[this.round].push(msg);
                this.send(this.nodeID, 'broadcast', msg);
            }
            else {
                const msg = {
                    type: 'precommit',
                    value: this.lock.value,
                    sender: this.nodeID,
                    round: this.round
                };
                this.precommits[this.round].push(msg);
                this.send(this.nodeID, 'broadcast', msg);
            }
            // go to step 3 after 2l
            this.clock = setTimeout(() => {
                this.step = 3;
                this.runBALogic();
            }, 2 * this.lambda * 1000);
        }
        else if (this.step === 3) {
            const r = this.getMaxResult(this.precommits[this.round]);
            if (r.count >= 2 * this.f + 1 && r.value !== 'SKIP') {
                this.lock.value = r.value;
                this.lock.round = this.round;
                const msg = {
                    type: 'commit',
                    value: r.value,
                    sender: this.nodeID,
                    round: this.round
                };
                this.commits[this.round].push(msg);
                this.send(this.nodeID, 'broadcast', msg);
            }
            else {
                const msg = {
                    type: 'commit',
                    value: 'SKIP',
                    sender: this.nodeID,
                    round: this.round
                };
                this.commits[this.round].push(msg);
                this.send(this.nodeID, 'broadcast', msg);
            }
        }
        this.reportToSystem();
    }

    receive(msg) {
        this.logger.info(['recv', JSON.stringify(msg)]);
        if (this.init) {
            this.logger.info(['recv', msg.type, JSON.stringify(msg)]);
        }
        if (this.isDecided) {
            return;
        }
        switch(msg.type) {
            case 'init':
                this.values.push(msg);
                break;
            case 'precommit':
                if (msg.round > this.precommits.length - 1) {
                    this.extendVectors(this.precommits,
                        msg.round - this.precommits.length + 1,
                        'precommit'
                    );
                }
                // push message to precommits according to round number
                // TODO: check illegal precommit
                this.precommits[msg.round].push(msg);
                // check: update lock value and go to next round
                if (msg.round > this.lock.round) {
                    this.updateLock(msg.round);
                }
                break;
            case 'commit':
                // push message to commits according to round number
                if (msg.round > this.commits.length - 1) {
                    this.extendVectors(this.commits,
                        msg.round - this.commits.length + 1,
                        'commit'
                    );
                }
                // TODO: check illegal commit
                this.commits[msg.round].push(msg);
                // check conditions
                // check: decide
                if (this.decide(msg.round)) {
                    return;
                }
                // check: go to next round and keep up round number
                if (this.forwardNextRound(msg.round)) {
                    return;
                }
                break;
            case 'decide':
                // save message to decides
                this.decides[msg.sender] = msg;
                // add precommits according to decide msg
                for (let r = msg.round; r < this.precommits.length; r++) {
                    // check repeat precommit
                    const hasPrecommit = this.precommits[r]
                        .some(precommit => precommit.sender === msg.sender);
                    if (!hasPrecommit) {
                        this.precommits[r].push({
                            type: 'precommit',
                            value: msg.value,
                            sender: msg.sender,
                            round: msg.round
                        });
                    }
                }
                // add commits according to decide msg
                for (let r = msg.round; r < this.commits.length; r++) {
                    // check repeat commit
                    const hasCommit = this.commits[r]
                        .some(commit => commit.sender === msg.sender);
                    if (!hasCommit) {
                        this.commits[r].push({
                            type: 'commit',
                            value: msg.value,
                            sender: msg.sender,
                            round: msg.round
                        });
                    }
                }
                // check: decide
                for (let round = this.commits.length - 1; round >= msg.round; round--) {
                    if (this.decide(round)) {
                        return;
                    }
                }
                // check: update lock value and go to next round
                for (let round = this.precommits.length - 1; round >= msg.round; round--) {
                    if (round > this.lock.round && this.updateLock(round)) {
                        return;
                    }
                }
                // check: go to next round and keep up round number
                for (let round = this.commits.length - 1; round >= msg.round; round--) {
                    if (round >= this.round && this.forwardNextRound(round)) {
                        return;
                    }
                }
                break;
            default:
                console.log('Unknown message type.');
        }
        this.reportToSystem();
    }

    reportToSystem() {
        const precommitsS = (this.precommits[this.round]) ?
            '' + this.precommits[this.round].length : '0';
        const commitsS = (this.commits[this.round]) ?
            '' + this.commits[this.round].length : '0';
        const decidedValueS = (this.decidedValue) ?
            this.decidedValue : 'NA';
        const isDecidedS = this.isDecided.toString();
        const lock = `(${this.lock.round}, ${this.lock.value})`;
        const info = {
            initValue: { s: this.initValue, w: 15 },
            round: { s: '' + this.round, w: 15 },
            precommits: { s: precommitsS, w: 15 },
            commits: { s: commitsS, w: 15 },
            isDecided: { s: isDecidedS, w: 15 },
            decidedValue: { s: decidedValueS, w: 15 },
            'lock(r, v)': { s: lock, w: 15 }
        };
        this.send(this.nodeID, 'system', {
            sender: this.nodeID,
            info: info
        });
    }

    constructor(nodeID, nodeNum) {
        super(nodeID, nodeNum);
        //this.isCooling = false;
        this.f = (this.nodeNum % 3 === 0) ?
            this.nodeNum / 3 - 1 : Math.floor(this.nodeNum / 3);
        
        // BA related
        this.values = [];
        this.precommits = [];
        this.commits = [];
        // nodeID => decide message;
        this.decides = {};
        this.isCommited = false;
        this.isDecided = false;
        this.round = 1;
        // store the value and round I committed
        this.lock = {
            value: undefined,
            round: 0
        };
        this.step = 1;
        this.lambda = config.lambda;
        // start BA process
        // propose init value
        this.initValue = '' + Math.floor(Math.random() * 100 + 1);
        const initMsg = {
            sender: this.nodeID,
            type: 'init',
            value: this.initValue
        };
        this.values.push(initMsg);
        // wait 2 sec for other nodes to initialize
        setTimeout(() => {
            this.send(this.nodeID, 'broadcast', initMsg);
            // go to step 2 after 2l
            this.clock = setTimeout(() => {
                this.step = 2;
                this.runBALogic();
            }, 2 * this.lambda * 1000);
        }, 2000);
    }
}
const n = new DEXONNode(process.argv[2], process.argv[3]);
