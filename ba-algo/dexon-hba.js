'use strict';

const Node = require('./node');
const config = require('../config');
const uuid = require('uuid/v4');

class DEXONNode extends Node {

    extendVectors(v, until, type) {
        const a = [];
        /*
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
        }*/
        const n = until - v.length + 1
        for (let i = 0; i < n; i++) {
            v.push(a);
        }
    }

    getMaxResult(roundData) {
        if (roundData === undefined || roundData.length === 0) {
            return { value: undefined, count: 0 };
        }
        return roundData.groupBy(msg => msg.value)
            // [[value, [msg]], [value, [msg]]]
            .map(e => ({ value: e[0], count: e[1].length }))
            // [{ value: v, count: 1 }, { value: v, count: 2 }]
            .maxBy(e => e.count);
            // { value: v, count: max }
    }

    updateLockRound(iter) {
        let r = this.getMaxResult(this.precommits[iter]);
        //this.logger.warning([`${r.count} ${r.value}`]);
        if (r.count >= 2 * this.f + 1 && r.value !== 'SKIP') {
            this.lock.value = r.value;
            this.lock.iter = iter;
            if (iter > this.iter) {
                this.iter = iter;
                this.lambda = config.lambda * Math.pow(2, this.iter - 1); 
                // directly jump to step 4
                this.step = 4;
                //clearTimeout(this.clock);
                this.runBALogic();
            }
            return true;
        }
        return false;
    }

    decide(iter) {
        let r = this.getMaxResult(this.commits[iter]);
        if (r.count >= 2 * this.f + 1 && r.value !== 'SKIP') {
            this.logger.info([`decides on ${r.value} in iter ${this.iter}`]);
            const proof = JSON.parse(JSON.stringify(this.commits[iter]));
            this.send(this.nodeID, 'broadcast', {
                type: 'decide',
                value: r.value,
                sender: this.nodeID,
                iter: this.iter,
                commits: proof.splice(0, 2 * this.f + 1)
            });
            this.decidedValue = r.value;
            this.isDecided = true;
            //clearTimeout(this.clock);
            // immediately report to system when decide
            this.reportToSystem();
            return true;
        }
        return false;
    }

    forwardIter(iter) {
        if (this.commits[iter].length >= 2 * this.f + 1) {
            this.iter = iter + 1;
            this.lambda = config.lambda * Math.pow(2, this.iter - 1);
            this.step = 4;
            //clearTimeout(this.clock);
            this.runBALogic();
            return true;
        }
        return false;
    }

    runBALogic() {
        // extend precommits and commits to current round
        this.extendVectors(this.precommits, this.iter, 'pre-com');
        this.extendVectors(this.commits, this.iter, 'com');
        switch (this.step) {
        case 1: {
            if (this.nodeID === '' + this.pioneer) {
                // pioneer
                this.logger.info(['start as fast-mode leader']);
                const fastMsg = {
                    sender: this.nodeID,
                    type: 'fast',
                    value: this.v
                };
                this.send(this.nodeID, 'broadcast', fastMsg);
                const precomMsg = {
                    sender: this.nodeID,
                    type: 'pre-com',
                    value: this.v,
                    iter: 0
                };
                this.precommits[0].push(precomMsg);
                this.send(this.nodeID, 'broadcast', precomMsg);
                this.step = 2;
                this.registerTimeEvent(
                    { name: 'runBALogic', params: { iter: this.iter, step: 3 } },
                    3 * this.lambda * 1000);
                /*
                this.clock = setTimeout(() => {
                    // start standard BA
                    this.step = 3;
                    this.runBALogic();
                }, 3 * this.lambda * 1000);*/
            }
            else {
                // not pioneer
                this.step = 2;
                this.registerTimeEvent(
                    { name: 'runBALogic', params: { iter: this.iter, step: 3 } },
                    3 * this.lambda * 1000);                
                /*
                this.clock = setTimeout(() => {
                    this.step = 3;
                    this.runBALogic();
                }, 3 * this.lambda * 1000);*/
            }
            break;
        }
        case 2: {
            // step 2 is message driven
            break;
        }
        case 3: {
            if (!this.isDecided) {
                // can not vote leader's block anymore
                const initMsg = {
                    sender: this.nodeID,
                    type: 'init',
                    value: this.v,
                    y: this.y
                };
                this.inits.push(initMsg);
                this.send(this.nodeID, 'broadcast', initMsg);
                // go to step 4 after 2l
                this.registerTimeEvent(
                    { name: 'runBALogic', params: { iter: this.iter, step: 4 } },
                    2 * this.lambda * 1000);
                /*
                this.clock = this.clock = setTimeout(() => {
                    this.step = 4;
                    this.runBALogic();
                }, 2 * this.lambda * 1000);*/
            }
            break;
        }
        case 4: {
            let msg = {
                type: 'pre-com',
                sender: this.nodeID,
                iter: this.iter
            };
            if (this.lock.value === 'BOT' || this.lock.value === 'SKIP') {
                msg.value = (this.inits.length > 0) ?
                    this.inits.minBy(msg => msg.y).value : 'BOT';
            }
            else {
                msg.value = this.lock.value;
            }
            this.precommits[this.iter].push(msg);
            this.send(this.nodeID, 'broadcast', msg);
            // go to step 5 after 2l
            this.registerTimeEvent(
                { name: 'runBALogic', params: { iter: this.iter, step: 5 } },
                2 * this.lambda * 1000);
            /*
            this.clock = setTimeout(() => {
                this.step = 5;
                this.runBALogic();
            }, 2 * this.lambda * 1000);*/
            break;
        }
        case 5: {
            const comMsg = {
                type: 'com',
                value: this.lock.value,
                sender: this.nodeID,
                iter: this.iter
            };
            this.commits[this.iter].push(comMsg);
            this.send(this.nodeID, 'broadcast', comMsg);
            break;
        }
        }
    }

    triggerMsgEvent(msg) {
        this.logger.info(['recv', JSON.stringify(msg)]);
        // for testing
        /*
        if (this.localClock > msg.sendTime + msg.delay) {
            console.log('reverse');
        }
        this.localClock = msg.sendTime + msg.delay * 1000;*/
        //console.log(Date.now() - msg.sendTime);
        if (this.init) {
            this.logger.info(['recv', msg.type, JSON.stringify(msg)]);
        }
        if (this.isDecided) {
            return;
        }
        switch (msg.type) {
        case 'fast': {
            if (msg.sender === '' + this.pioneer &&
                this.nodeID !== '' + this.pioneer &&
                this.step === 2) {
                // receive leader's block
                const precomMsg = {
                    type: 'pre-com',
                    value: msg.value,
                    sender: this.nodeID,
                    iter: 0
                };
                this.precommits[0].push(precomMsg);
                this.send(this.nodeID, 'broadcast', precomMsg);
            }
            break;
        }
        case 'pre-com': {
            this.extendVectors(this.precommits, msg.iter, 'pre-com');
            // push message to precommits according to iter number
            // TODO: check illegal precommit
            this.precommits[msg.iter].push(msg);
            // check: update lock value and go to next iter
            if (msg.iter > this.lock.iter) {
                this.updateLockRound(msg.iter);
            }
            if (this.step === 2 && !this.hasFastCommitted) {
                const r = this.getMaxResult(this.precommits[this.iter]);
                if (r.count >= 2 * this.f + 1 && r.value !== 'SKIP') {
                    const comMsg = {
                        type: 'com',
                        value: this.lock.value,
                        sender: this.nodeID,
                        iter: 0
                    };
                    this.extendVectors(this.commits, this.iter, 'com');            
                    this.commits[0].push(comMsg);
                    this.send(this.nodeID, 'broadcast', comMsg);
                    this.hasFastCommitted = true;
                }
            }
            break;
        }
        case 'com': {
            // push message to commits according to round number
            this.extendVectors(this.commits, msg.iter, 'com');
            // TODO: check illegal commit
            this.commits[msg.iter].push(msg);
            // check: decide
            if (this.decide(msg.iter)) {
                return;
            }
            // check: forward round
            if (msg.iter >= this.iter) {
                this.forwardIter(msg.iter);
            }
            break;
        }
        case 'init': {
            this.inits.push(msg);
            break;
        }
        case 'decide': {
            this.extendVectors(this.commits, msg.iter, 'com');
            msg.commits.forEach(comMsg => {
                if (!this.commits[msg.iter]
                    .some(myComMsg => myComMsg.sender === comMsg.sender)) {
                    this.commits[msg.iter].push(comMsg);
                }
            });
            this.decide(msg.iter);
            break;
        }
/*
            // save message to decides  
            this.decides[msg.sender] = msg;
            // add precommits according to decide msg
            for (let r = msg.iter; r < this.precommits.length; r++) {
                // check repeat precommit
                const hasPrecommit = this.precommits[r]
                    .some(precommit => precommit.sender === msg.sender);
                if (!hasPrecommit) {
                    this.precommits[r].push({
                        type: 'precommit',
                        value: msg.value,
                        sender: msg.sender,
                        iter: msg.iter
                    });
                }
            }
            // add commits according to decide msg
            for (let r = msg.iter; r < this.commits.length; r++) {
                // check repeat commit
                const hasCommit = this.commits[r]
                    .some(commit => commit.sender === msg.sender);
                if (!hasCommit) {
                    this.commits[r].push({
                        type: 'commit',
                        value: msg.value,
                        sender: msg.sender,
                        iter: msg.iter
                    });
                }
            }
            // check: decide
            for (let iter = this.commits.length - 1; iter >= msg.iter; iter--) {
                if (this.decide(iter)) {
                    return;
                }
            }
            // check: update lock value and go to iter
            for (let iter = this.precommits.length - 1; iter >= msg.iter; iter--) {
                if (iter > this.lock.iter && this.updateLockRound(iter)) {
                    return;
                }
            }
            // check: go to iter and keep up round number
            for (let iter = this.commits.length - 1; iter >= msg.iter; iter--) {
                if (iter >= this.iter && this.forwardIter(iter)) {
                    return;
                }
            }  
            break;*/
        default: 
            console.log('unknown message type in standard mode');
        }
        this.reportToSystem();
    }
    triggerTimeEvent(functionMeta) {
        // prevent older events
        if (functionMeta.params.iter < this.iter) return;
        this.step = functionMeta.params.step;
        this.runBALogic();
    }

    reportToSystem() {
        const precommitsS = (this.precommits[this.round]) ? 
            '' + this.precommits[this.round].length : '0';
        const commitsS = (this.commits[this.round]) ? 
            '' + this.commits[this.round].length : '0';
        const decidedValueS = (this.decidedValue) ?
            this.decidedValue : 'NA';
        const isDecidedS = this.isDecided.toString();
        const lock = `(${this.lock.iter}, ${this.lock.value})`;
        const info = {
            initValue: { s: this.initValue, w: 15 },
            round: { s: '' + this.iter, w: 15 },
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

    constructor(nodeID, nodeNum, network, registerTimeEvent) {
        super(nodeID, nodeNum, network, registerTimeEvent);
        this.f = (this.nodeNum % 3 === 0) ? 
            this.nodeNum / 3 - 1 : Math.floor(this.nodeNum / 3);  
        // BA related
        this.inits = [];
        this.precommits = [];
        this.commits = [];

        this.pioneer = 1;
        this.hasFastCommitted = false;
        // nodeID => decide message;
        this.decides = {};
        this.isDecided = false;
        this.iter = 1;
        this.lock = {
            value: 'SKIP',
            iter: -1
        };
        this.lambda = config.lambda;
        this.v = uuid();
        this.y = Math.floor(Math.random() * 10000 + 1);
        this.registerTimeEvent({ name: '', params: { iter: this.iter, step: 1 } }, 0);
    }
}
//const n = new DEXONNode(process.argv[2], process.argv[3]);
module.exports = DEXONNode;