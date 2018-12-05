'use strict';

const Node = require('../node');
const config = require('../../config');
const uuid = require('uuid/v4');

class VMwareNode extends Node {

    runBALogic(round) {
        switch (round) {
        case 1:
            // end of notify and start of status
            this.notify.forEach(msg => {
                this.accepted.vi = msg.notify.v;
                this.accepted.Ci = msg.Ci;
                this.accepted.ki = this.k;
            });
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
            setTimeout(() => {
                this.runBALogic(2);
            }, 2 * config.lambda * 1000);
            break;
        case 2:
            // end of status and start of propose
            if (this.leader === this.nodeID) {
                this.accepted.vi = uuid();
                this.accepted.ki = 0;
                this.accepted.Ci = 'undefined';
                if (this.status.length > 0) {
                    const msg = this.status.groupBy(msg => msg.ki)[0][1][0];
                    if (msg.Ci !== 'undefined') {
                        this.accepted.vi = msg.vi;
                        this.accepted.ki = msg.ki;
                        this.accepted.Ci = msg.Ci;
                    }
                }
                const proposeMsg = {
                    sender: this.nodeID,
                    type: 'fl-propose',
                    proposeMsg: {
                        sender: this.nodeID,
                        k: this.k,
                        type: 'propose',
                        vL: this.accepted.vi
                    },
                    kL: this.accepted.ki,
                    CL: this.accepted.Ci
                };
                this.send(this.nodeID, 'broadcast', proposeMsg);
                this.send(this.nodeID, this.nodeID, proposeMsg);
                this.status = [];
            }
            setTimeout(() => {
                this.runBALogic(3);
            }, 2 * config.lambda * 1000);
            break;
        case 3:
            // end of propose and start of commit
            if (this.vLi !== 'undefined') {
                // forward leader propose
                this.send(this.nodeID, 'broadcast', this.proposeMsg);
                const commitMsg = {
                    sender: this.nodeID,
                    k: this.k,
                    type: 'commit',
                    vLi: this.vLi
                };
                this.send(this.nodeID, 'broadcast', commitMsg);
                this.send(this.nodeID, this.nodeID, commitMsg);
            }
            setTimeout(() => {
                this.runBALogic(4);
            }, 2 * config.lambda * 1000);
            break;
        case 4:
            // end of commit and start of notify
            if (this.propose.some(msg => msg.vL !== this.vLi)) {
                // leader has equivocated
                // do not commit
            }
            else {
                const C = this.commit.filter(msg => msg.vLi === this.vLi);
                if (C.length >= this.f + 1) {
                    this.accepted.vi = this.vLi;
                    this.accepted.Ci = C;
                    this.logger.info(['decide', this.vLi]);
                    const notifyMsg = {
                        sender: this.nodeID,
                        type: 'notify',
                        notify: {
                            sender: this.nodeID,
                            type: 'notify-header',
                            v: this.vLi
                        },
                        Ci: C
                    };
                    this.send(this.nodeID, 'broadcast', notifyMsg);
                }
            }
            this.propose = [];
            this.commit = [];
            this.vLi = 'undefined';
            setTimeout(() => {
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
            if (this.leader === this.nodeID) {
                // verify msg.Ci
                this.status.push(msg);
            }
            break;
        case 'fl-propose':
            if (msg.sender === this.leader) {
                if (msg.kL >= this.accepted.ki) {
                    this.vLi = msg.proposeMsg.vL;
                    this.proposeMsg = msg.proposeMsg;
                }
                else {
                    // leader is faulty
                    this.vLi = 'undefined';
                }
            }
            break;
        case 'propose':
            this.propose.push(msg);
            break;
        case 'commit':
            this.commit.push(msg);
            break;
        case 'notify':
            this.notify.push(msg);
            break;
        default: 
            this.logger.warning(['unknown message type']);
        }
        this.reportToSystem();
    }

    reportToSystem() {
        /*
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
        });*/
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
        this.k = 12;
        this.vLi = 'undefined';
        this.leader = '' + (this.k % this.nodeNum + 1);
        this.status = [];
        this.propose = [];
        this.commit = [];
        this.notify = [];
        // wait 2 sec for other nodes to initialize
        const initStatusMsg = {
            sender: this.nodeID,
            type: 'status',
            k: this.k,
            vi: this.accepted.vi,
            ki: this.accepted.ki,
            Ci: this.accepted.Ci
        };
        setTimeout(() => {
            this.send(this.nodeID, this.leader, initStatusMsg);
            // go to round 2 after 2l
            setTimeout(() => {
                this.runBALogic(2);
            }, 2 * config.lambda * 1000);
        }, 2000);
    }
}
const n = new VMwareNode(process.argv[2], process.argv[3]);