'use strict';

const Node = require('./node');
const uuid = require('uuid/v4');

class PBFTNode extends Node {
    // extend vector v to be able to access v[n] = array
    extendVector(v, n) {
        if (v[n] === undefined) {
            v[n] = [];
        }
    }
    // extend vector v to be able to access v[n][m] = array
    extendVector2D(v, n, m) {
        if (v[n] === undefined) {
            this.extendVector(v, n);
        }
        if (v[n][m] === undefined) {
            this.extendVector(v[n], m);
        }
    }
    isPrepared(d, v, n) {
        // m is in log
        // pre-prepare<m, v, n> is in log
        // 2f + 1 prepare<v, n, d, i> is in log that match pre-prepare<m, v, n>
        if (this.digest[d] !== undefined &&
            this.prePrepare[v][n][0] !== undefined) {
            const d = this.prePrepare[v][n][0].d;
            const count = this.prepare[v][n]
                .filter(msg => (msg.d === d))
                .length;
            return (count >= 2 * this.f + 1);
        }
        return false;
    }
    isCommittedLocal(d, v, n) {
        // isPrepared(d, v, n) is true
        // 2f + 1 commit<v, n, d, i> is in log that match pre-prepare<m, v, n>
        if (this.isPrepared(d, v, n)) {
            const d = this.prePrepare[v][n][0].d;
            const count = this.commit[v][n]
                .filter(msg => (msg.d === d))
                .length;
            return (count >= 2 * this.f + 1);
        }
        return false;
    }
    isStableCheckpoint(n) {
        if (this.checkpoint[n] === undefined || 
            this.checkpoint[n].length === 0) {
            return false;
        }
        const count = this.checkpoint[n].groupBy(msg => msg.d)
            .map(e => e[1].length)
            .max();
        return (count >= 2 * this.f + 1);
    }

    receive(msg) {
        this.logger.info(['recv', JSON.stringify(msg)]);
        if (this.isInViewChange && 
            (msg.type !== 'checkpoint' && 
            msg.type !== 'view-change' &&
            msg.type !== 'new-view')) {
            return;
        }
        if (msg.type === 'pre-prepare') {
            // check signature, view, sequence number unique and its range
            if (msg.v !== this.view) {
                return;
            }
            // push pre-prepare
            this.extendVector2D(this.prePrepare, msg.v, msg.n);
            // pre-prepare[v][n] should only have one message
            if (this.prePrepare[msg.v][msg.n].length === 0) {
                clearTimeout(this.receiveTimer);
                this.receiveTimer = setTimeout(() => {
                    // did not receive any message in receive timeout
                    if (!this.isInViewChange) {
                        this.logger.info(['did not receive any request']);
                        this.startViewChange();
                    }
                }, this.receiveTimeout * 1000);
                this.prePrepare[msg.v][msg.n].push(msg);
                if (this.digest[msg.d] === undefined) {
                    this.digest[msg.d] = {
                        isReceived: true,
                        isPrepared: false,
                        isDecided: false,
                        // check if a request is executed in time
                        timer: setTimeout(() => {
                            if (!this.isInViewChange) {
                                this.logger.info(['not executed in time']);
                                this.startViewChange();
                            }
                        }, this.executeTimeout * 1000)
                    };
                }
                // send prepare
                const prepareMsg = {
                    type: 'prepare',
                    v: msg.v,
                    n: msg.n,
                    d: msg.d,
                    i: this.nodeID
                };
                this.extendVector2D(this.prepare, msg.v, msg.n);
                this.prepare[msg.v][msg.n].push(prepareMsg);
                this.send(this.nodeID, 'broadcast', prepareMsg);
            }
            else {
                this.logger.warning(['pre-prepare conflict']);
            }
        }
        else if (msg.type === 'prepare') {
            // check signature, view, sequence number unique and its range
            if (msg.v !== this.view) {
                return;
            }
            // push prepare
            this.extendVector2D(this.prePrepare, msg.v, msg.n);
            this.extendVector2D(this.prepare, msg.v, msg.n);
            // prepare may contain msg with different digests
            this.prepare[msg.v][msg.n].push(msg);
            if (this.digest[msg.d] && this.digest[msg.d].isPrepared) {
                return;
            }
            if (this.isPrepared(msg.d, msg.v, msg.n)) {
                this.digest[msg.d].isPrepared = true;
                const commitMsg = {
                    type: 'commit',
                    v: msg.v,
                    n: msg.n,
                    d: msg.d,
                    i: this.nodeID
                };
                this.extendVector2D(this.commit, msg.v, msg.n);
                this.commit[msg.v][msg.n].push(commitMsg);
                this.send(this.nodeID, 'broadcast', commitMsg);
            }
        }
        else if (msg.type === 'commit') {
            // check signature, view, sequence number unique and its range
            if (msg.v !== this.view) {
                return;
            }
            // push commit
            this.extendVector2D(this.prePrepare, msg.v, msg.n);
            this.extendVector2D(this.prepare, msg.v, msg.n);
            this.extendVector2D(this.commit, msg.v, msg.n);
            this.commit[msg.v][msg.n].push(msg);
            if (this.digest[msg.d] && this.digest[msg.d].isDecided) {
                return;
            }
            // check committed local
            if (this.isCommittedLocal(msg.d, msg.v, msg.n)) {
                clearTimeout(this.digest[msg.d].timer);
                this.digest[msg.d].isDecided = true;
                this.lastDecidedSeq = msg.n;
                this.lastDecidedRequest = msg.d;             
                this.logger.info(['decide', msg.d]);
                if (msg.n % this.checkpointPeriod === 0) {
                    const checkpointMsg = {
                        type: 'checkpoint',
                        n: msg.n,
                        d: msg.d,
                        i: this.nodeID
                    };
                    this.extendVector(this.checkpoint, msg.n);
                    this.checkpoint[msg.n].push(checkpointMsg);
                    this.send(this.nodeID, 'broadcast', checkpointMsg);
                }
            }
        }
        else if (msg.type === 'checkpoint') {
            this.extendVector(this.checkpoint, msg.n);
            this.checkpoint[msg.n].push(msg);
            // earliest checkpoint that is not stable
            let usCheckpoint = 
                this.lastStableCheckpoint + this.checkpointPeriod;
            if (msg.n === usCheckpoint) {
                while (this.isStableCheckpoint(usCheckpoint)) {
                    this.logger.info([`create stable checkpoint ${usCheckpoint}`]);
                    this.lastStableCheckpoint = usCheckpoint;
                    usCheckpoint += this.checkpointPeriod;
                }
            }
        }
        else if (msg.type === 'view-change') {
            // somehow verify this is a reasonable view change msg
            // checkpoint proof is provided
            this.extendVector(this.viewChange, msg.v);
            this.viewChange[msg.v].push(msg);
            if (this.isPrimary) {
                return;
            }
            if (this.viewChange[msg.v].length >= 2 * this.f + 1 && 
                (msg.v % this.nodeNum) === (parseInt(this.nodeID) - 1)) {
                this.logger.info(['start as a primary']);
                this.isPrimary = true;
                this.isInViewChange = false;
                this.view = msg.v;
                const minS = this.viewChange[msg.v]
                    .map(msg => msg.n)
                    .max();
                const allPrePrepare = this.viewChange[msg.v]
                    .map(msg => msg.P)
                    .map(P => P.map(Pm => Pm['pre-prepare']))
                    .flat();
                const maxS = (allPrePrepare.length === 0) ? 
                    minS : allPrePrepare.map(msg => msg.n).max();
                const O = [];
                for (let n = minS + 1; n <= maxS; n++) {
                    const pmsg = allPrePrepare.find(msg => msg.n === n);
                    const d = (pmsg === undefined) ? 'nop' : pmsg.d;
                    // re-consensus d
                    this.digest[d] = {
                        isReceived: true,
                        isPrepared: false,
                        isDecided: false,
                    };
                    const prePrepareMsg = {
                        type: 'pre-prepare',
                        v: msg.v,
                        n: n,
                        d: d
                    };
                    this.extendVector2D(this.prePrepare, msg.v, n);
                    this.prePrepare[msg.v][n].push(prePrepareMsg);
                    const prepareMsg = {
                        type: 'prepare',
                        v: msg.v,
                        n: n,
                        d: d,
                        i: this.nodeID
                    };
                    this.extendVector2D(this.prepare, msg.v, n);
                    this.prepare[msg.v][n].push(prepareMsg);
                    // broadcast this after every node enter view v
                    setTimeout(() => {
                        this.send(this.nodeID, 'broadcast', prepareMsg);
                    }, 1 * 1000);
                    O.push({
                        v: msg.v,
                        n: n,
                        d: d
                    });
                }
                const newViewMsg = {
                    type: 'new-view',
                    v: msg.v,
                    V: this.viewChange[msg.v],
                    O: O
                };
                this.send(this.nodeID, 'broadcast', newViewMsg);
                // next seq starts from maxS + 1
                this.seq = maxS + 1;
                // start as primary after every node enter view v
                setTimeout(() => {
                    this.startPrimary();
                }, 2 * 1000);
            }
        }
        else if (msg.type === 'new-view') {
            // new primary
            if (this.isPrimary &&
                (msg.v % this.nodeNum) === (parseInt(this.nodeID) - 1)) {
                return;
            }
            // old primary
            if (this.isPrimary) {
                this.logger.info(['switch to backup node']);
                clearInterval(this.proposeTimer);
                this.isPrimary = false;
            }
            // somehow verify O and V is reasonable
            this.view = msg.v;
            this.isInViewChange = false;
            msg.O.forEach(msg => {
                // push pre-prepare
                this.extendVector2D(this.prePrepare, msg.v, msg.n);
                // pre-prepare[v][n] should only have one message
                if (this.prePrepare[msg.v][msg.n].length === 0) {
                    // re-consensus d
                    this.prePrepare[msg.v][msg.n].push(msg);
                    this.digest[msg.d] = {
                        isReceived: true,
                        isPrepared: false,
                        isDecided: false,
                        // check if a request is executed in time
                        timer: setTimeout(() => {
                            if (!this.isInViewChange) {
                                this.logger.info(['not executed in time']);
                                this.startViewChange();
                            }
                        }, this.executeTimeout * 1000)
                    };
                    // send prepare
                    const prepareMsg = {
                        type: 'prepare',
                        v: msg.v,
                        n: msg.n,
                        d: msg.d,
                        i: this.nodeID
                    };
                    this.extendVector2D(this.prepare, msg.v, msg.n);
                    this.prepare[msg.v][msg.n].push(prepareMsg);
                    // send when other nodes receive new-view
                    this.send(this.nodeID, 'broadcast', prepareMsg);
                }
                else {
                    this.logger.warning(['pre-prepare conflict']);
                }
            });
            this.receiveTimer = setTimeout(() => {
                // did not receive any message in receive timeout
                if (!this.isInViewChange) {
                    this.logger.info(['did not receive any request']);
                    this.startViewChange();
                }
            }, this.receiveTimeout * 1000);
        }
        else {
            this.logger.warning(['undefined msg type']);
        }
    }

    startViewChange() {
        this.logger.info(['start a view change']);
        this.isInViewChange = true;

        const p = (this.prePrepare[this.view] === undefined) ? [] :
            this.prePrepare[this.view]
            .slice(this.lastStableCheckpoint + 1)
            .filter(msgArray => {
                if (msgArray.length === 0) {
                    return false;
                }
                return this.digest[msgArray[0].d].isPrepared;
            })
            .map((msgArray) => {
                const msg = msgArray[0];
                return {
                    'pre-prepare': msg,
                    prepare: this.prepare[msg.v][msg.n]
                            .filter(_msg => _msg.d === msg.d)
                };
            });
        const viewChangeMsg = {
            type: 'view-change',
            v: this.view + 1,
            n: this.lastStableCheckpoint,
            C: (this.lastStableCheckpoint < 0) ? [] :
                this.checkpoint[this.lastStableCheckpoint]
                    .groupBy(msg => msg.d)
                    .maxBy(pair => pair[1].length)[1],
            P: p,
            i: this.nodeID 
        }
        this.extendVector(this.viewChange, this.view + 1);        
        this.viewChange[this.view + 1].push(viewChangeMsg);
        this.send(this.nodeID, 'broadcast', viewChangeMsg);
        const oldView = this.view;
        // if the next primary is also dead
        const skipToNextView = () => {
            if (this.view === oldView) {
                this.logger.info(['skip to next view']);
                const view = viewChangeMsg.v;
                viewChangeMsg.v = view + 1;
                this.extendVector(this.viewChange, view + 1);        
                this.viewChange[view + 1].push(viewChangeMsg);
                this.send(this.nodeID, 'broadcast', viewChangeMsg);
                setTimeout(() => {
                    skipToNextView();
                }, 3000);
            }
        };
        setTimeout(() => {
            skipToNextView();
        }, 3000);
    }

    startPrimary() {
        this.proposeTimer = setInterval(() => {
            const request = uuid();
            this.digest[request] = {
                isReceived: true,
                isPrepared: false,
                isDecided: false,
                /*
                // check if a request is executed in time
                timer: setTimeout(() => {
                    console.log('not executed in time');
                }, this.executeTimeout * 1000)*/
            };
            const prePrepareMsg = {
                type: 'pre-prepare',
                v: this.view,
                n: this.seq,
                d: request
            };
            this.extendVector2D(this.prePrepare, this.view, this.seq);
            this.prePrepare[this.view][this.seq].push(prePrepareMsg);
            this.send(this.nodeID, 'broadcast', prePrepareMsg);
            
            const prepareMsg = {
                type: 'prepare',
                v: this.view,
                n: this.seq,
                d: request,
                i: this.nodeID
            };
            this.extendVector2D(this.prepare, this.view, this.seq);
            this.prepare[this.view][this.seq].push(prepareMsg);
            this.send(this.nodeID, 'broadcast', prepareMsg);
            this.seq++;
        }, this.proposePeriod * 1000);
        // stop proposing after 10 sec
        /*
        setTimeout(() => {
            clearInterval(this.proposeTimer);
            //this.isPrimary = false;
        }, 8 * 1000);*/
    }
    
    reportToSystem() {
        const info = {
            view: { s: '' + this.view, w: 15 },
            seq: { s: '' + this.seq, w: 15 },
            isPrimary: { s: '' + this.isPrimary, w: 15 },
            isInViewChange: { s: '' + this.isInViewChange, w: 15 },            
            checkpoint: { s: '' + this.lastStableCheckpoint, w: 15 },
            isDecided: { s: 'false', w: 15 },
            lastDecidedSeq: { s: '' + this.lastDecidedSeq, w: 15 },
            lastDecidedRequest: { s: this.lastDecidedRequest, w: 50 },
        };
        this.send(this.nodeID, 'system', {
            sender: this.nodeID,
            info: info
        });
    }

    constructor(nodeID, nodeNum) {
        super(nodeID, nodeNum);
        this.f = (this.nodeNum % 3 === 0) ? 
            this.nodeNum / 3 - 1 : Math.floor(this.nodeNum / 3);
        // pbft
        this.view = 0;
        this.seq = 0;
        this.isPrimary = 
            (this.view % this.nodeNum) === (parseInt(this.nodeID) - 1);
        this.checkpointPeriod = 3;
        this.isInViewChange = false;
        this.proposePeriod = 2;
        this.lastDecidedSeq = -1;
        this.lastDecidedRequest = '';
        // view change
        // check if a node receive a request in time
        this.receiveTimeout = 5;
        this.hasReceiveRequest = false;
        this.executeTimeout = 4;
        // this makes nodes create checkpoint at n = 0
        this.lastStableCheckpoint = -this.checkpointPeriod;
        // log
        this.digest = {};
        this.prePrepare = [];
        this.prepare = [];
        this.commit = [];
        this.checkpoint = [];
        this.viewChange = [];
        // system
        //this.isDecided = false;
        //this.decidedValue = {};
        // start after 2s
        setTimeout(() => {
            if (this.isPrimary) {
                this.startPrimary();
            }
            else {
                this.receiveTimer = setTimeout(() => {
                    // did not receive any message in receive timeout
                    if (!this.isInViewChange) {
                        this.logger.info(['did not receive any request']);
                        this.startViewChange();
                    }
                }, this.receiveTimeout * 1000);
            }
        }, 2000);
    }
}
const n = new PBFTNode(process.argv[2], process.argv[3]);
