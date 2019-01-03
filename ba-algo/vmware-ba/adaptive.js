'use strict';

const Node = require('../node');
const config = require('../../config');
const uuid = require('uuid/v4');

class VMwareNode extends Node {

    // extend vector v to be able to access v[n] = array
    extendVector(v, n) {
        if (v[n] === undefined) {
            v[n] = [];
        }
    }

    decide(v) {
        clearTimeout(this.BALogicTimer);        
        this.logger.info([`decide on ${v}`]);
        this.isDecided = true;
        this.decidedValue = v;        
    }

    runBALogic(round) {
        switch (round) {
        case 1:
            // end of notify and start of status
            this.extendVector(this.notify, this.k);
            if (this.notify[this.k].length > 0) {
                const msg = this.notify[this.k][0];
                this.accepted.vi = msg.notify.v;
                this.accepted.Ci = msg.Ci;
                this.accepted.ki = this.k;
            };
            this.k++;
            this.leader = '' + (this.k % this.nodeNum + 1);
            const statusMsg = {
                sender: this.nodeID,
                k: this.k,
                type: 'status',
                vi: this.accepted.vi,
                ki: this.accepted.ki,
                Ci: this.accepted.Ci
            };
            this.send(this.nodeID, this.leader, statusMsg);
            this.BALogicTimer = setTimeout(() => {
                this.runBALogic(2);
            }, 2 * config.lambda * 1000);
            break;
        case 2:
            // end of status and start of prepare1
            this.accepted.vi = uuid();
            this.accepted.ki = 0;
            this.accepted.Ci = 'undefined';
            if (this.status.length > 0) {
                const msg = this.status
                    .groupBy(msg => msg.ki)
                    // [['ki', [status msg]], ['ki', [status msg]]]
                    .maxBy(arr => parseInt(arr[0]))[1][0];
                if (msg.Ci !== 'undefined') {
                    this.accepted.vi = msg.vi;
                    this.accepted.ki = msg.ki;
                    this.accepted.Ci = msg.Ci;
                }
            }
            const prepare1Msg = {
                sender: this.nodeID,
                type: 'prepare1',
                vi: this.accepted.vi,
                k: this.k
            };
            this.send(this.nodeID, 'broadcast', prepare1Msg);
            this.send(this.nodeID, this.nodeID, prepare1Msg);
            this.status = [];
            this.BALogicTimer = setTimeout(() => {
                this.runBALogic(3);
            }, 2 * config.lambda * 1000);
            break;
        case 3:
            // end of prepare1 and start of prepare2
            this.prepare1.forEach(msg => {
                const prepare2Msg = {
                    sender: this.nodeID,
                    type: 'prepare2',
                    vi: msg.vi,
                    k: msg.k
                };
                this.send(this.nodeID, msg.sender, prepare2Msg);
            });
            this.prepare1 = [];
            this.BALogicTimer = setTimeout(() => {
                this.runBALogic(4);
            }, 2 * config.lambda * 1000);
            break;
        case 4:
            // end of prepare2 and start of propose
            if (this.prepare2.length < this.f + 1) {
                return;
            }
            const proposeMsg = {
                sender: this.nodeID,
                type: 'fl-propose',
                proposeMsg: {
                    sender: this.nodeID,
                    k: this.k,
                    type: 'propose',
                    vL: this.accepted.vi,
                    prepared: this.prepare2
                },
                kL: this.accepted.ki,
                CL: this.accepted.Ci
            };
            this.send(this.nodeID, 'broadcast', proposeMsg);
            this.send(this.nodeID, this.nodeID, proposeMsg);
            this.prepare2 = [];
            this.BALogicTimer = setTimeout(() => {
                this.runBALogic(5);
            }, 2 * config.lambda * 1000);
            break;
        case 5:
            // end of propose and start of elect
            const electMsg = {
                sender: this.nodeID,
                type: 'elect',
                // VRF
                y: Math.floor(Math.random() * 100 + 1)
            };
            this.send(this.nodeID, 'broadcast', electMsg);
            this.send(this.nodeID, this.nodeID, electMsg);
            this.BALogicTimer = setTimeout(() => {
                this.runBALogic(6);
            }, 2 * config.lambda * 1000);
            break;
        case 6:
            // end of elect and start of commit
            // remove duplicate leader proposal
            this.flPropose = this.flPropose
                .groupBy(msg => msg.sender)
                // [[sender, [msg]], [sender, [msg]]]
                .filter(arr => arr[1].length <= 1)
                .map(arr => arr[1])
                // [[msg], [msg]]
                .flat();
            this.flPropose.sort((msgA, msgB) => {
                if (msgA.kL < msgB.kL) {
                    return 1;
                }
                else if (msgA.kL > msgB.kL) {
                    return -1;
                }
                else {
                    return (msgA.proposeMsg.y < msgB.proposeMsg.y) ? 1 : -1;
                }
            });
            const bestProposal = this.flPropose[0];
            if (bestProposal === undefined || bestProposal.kL < this.accepted.ki) {
                // leader is faulty or no leader
                this.vLi = 'undefined';
            }
            else {
                this.proposeMsg = bestProposal.proposeMsg;
                this.vLi = this.proposeMsg.vL;
            }
            if (this.vLi !== 'undefined') {
                // forward leader propose
                this.send(this.nodeID, 'broadcast', this.proposeMsg);
                const commitMsg = {
                    sender: this.nodeID,
                    k: this.k,
                    type: 'commit',
                    vLi: this.vLi,
                    y: this.proposeMsg.y
                };
                this.send(this.nodeID, 'broadcast', commitMsg);
                this.send(this.nodeID, this.nodeID, commitMsg);
            }
            this.flPropose = [];
            this.elect = {};
            this.BALogicTimer = setTimeout(() => {
                this.runBALogic(7);
            }, 2 * config.lambda * 1000);
            break;
        case 7:
            // end of commit and start of notify
            if (this.propose.some(msg => msg.vL !== this.vLi)) {
                // leader has equivocated
                // do not commit
                this.logger.warning(['leader has equivocated']);
            }
            else {
                const C = this.commit.filter(msg => msg.vLi === this.vLi);
                if (C.length >= this.f + 1) {
                    this.accepted.vi = this.vLi;
                    this.accepted.Ci = C;
                    const notifyMsg = {
                        sender: this.nodeID,
                        type: 'notify',
                        header: {
                            sender: this.nodeID,
                            type: 'notify-header',
                            v: this.vLi
                        },
                        Ci: C
                    };
                    this.send(this.nodeID, 'broadcast', notifyMsg);
                    this.send(this.nodeID, this.nodeID, notifyMsg);                    
                }
            }
            this.propose = [];
            this.commit = [];
            this.vLi = 'undefined';
            this.BALogicTimer = setTimeout(() => {
                this.runBALogic(1);
            }, 2 * config.lambda * 1000);
            break;
        default:
            this.logger.warning(['unknown round']);
        }

    }

    receive(msg) {
        this.logger.info(['recv', JSON.stringify(msg)]);
        if (this.isDecided) {
            return;
        }
        switch(msg.type) {
        case 'status':
            // verify msg.Ci
            this.status.push(msg);
            break;
        case 'prepare1':
            this.prepare1.push(msg);
            break;
        case 'prepare2':
            this.prepare2.push(msg);
            break;
        case 'fl-propose':
            this.flPropose.push(msg);
            break;
        case 'propose':
            this.propose.push(msg);
            break;
        case 'elect':
            this.elect[msg.sender] = msg.y;
            break;
        case 'commit':
            this.commit.push(msg);
            break;
        case 'notify':
            const k = msg.Ci[0].k;
            this.extendVector(this.notify, k);
            this.notify[k].push(msg);
            if (this.notify[k].length >= this.f + 1) {
                const headers = this.notify[k]
                    .map(notifyMsg => notifyMsg.header);
                const headerMsg = {
                    sender: this.nodeID,
                    type: 'notify-headers',
                    headers: headers
                };
                this.send(this.nodeID, 'broadcast', headerMsg);
                this.decide(headers[0].v);
            }
            break;
        case 'notify-headers':
            // sanity check
            const headerMsg = {
                sender: this.nodeID,
                type: 'notify-headers',
                headers: msg.headers
            };
            this.send(this.nodeID, 'broadcast', headerMsg);
            this.decide(msg.headers[0].v);
            break;
        default: 
            this.logger.warning(['unknown message type']);
        }
        this.reportToSystem();
    }

    reportToSystem() {
        const acceptedS = `(${this.accepted.vi}, ${this.accepted.ki})`;
        const info = {
            round: { s: '' + this.k, w: 15 },
            leader: { s: this.leader, w: 15 },
            accepted: { s: acceptedS, w: 70 },
            isDecided: { s: `${this.isDecided}`, w: 15 },
            decidedValue: { s: `${this.decidedValue}`, w: 15 }            
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
        // store all accepted
        this.accepteds = [];
        this.accepted = { 
            vi: 'undefined', 
            ki: 0,
            Ci: 'undefined'
        };
        this.k = 1;
        this.vLi = 'undefined';
        this.leader;
        this.status = [];
        this.flPropose = [];
        this.propose = [];
        this.commit = [];
        this.notify = [];
        this.prepare1 = [];
        this.prepare2 = [];
        this.elect = {};
        this.isDecided = false;
        this.decidedValue = undefined;        
        // wait 2 sec for other nodes to initialize
        const initStatusMsg = {
            sender: this.nodeID,
            type: 'status',
            k: this.k,
            vi: this.accepted.vi,
            ki: this.accepted.ki,
            Ci: this.accepted.Ci
        };
        this.status.push(initStatusMsg);
        setTimeout(() => {
            this.send(this.nodeID, 'broadcast', initStatusMsg);
            // go to round 2 after 2l
            setTimeout(() => {
                this.runBALogic(2);
            }, 2 * config.lambda * 1000);
        }, 2000);
    }
}
const n = new VMwareNode(process.argv[2], process.argv[3]);