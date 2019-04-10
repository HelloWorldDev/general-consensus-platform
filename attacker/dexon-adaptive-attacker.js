'use strict';
// implement strongly-adaptive attack for DEXON HBA
const config = require('../config');
const Attacker = require('./attacker');

class AdaptiveAttacker extends Attacker {

    updateParam() {
        this.byzantines = [];
        this.proposes = [];
        for (let nodeID = 1; nodeID <= config.nodeNum; nodeID++) {
            this.sendIndex['' + nodeID] = 0;
        }
        return false;
    }

    triggerTimeEvent(timeEvent) {
        const functionMeta = timeEvent.functionMeta;        
        const msg = functionMeta.params.msg;
        if (functionMeta.params.dst === 'A') {
            this.groupA.forEach((dst) => {
                this.send('attacker', dst, msg);
            });
        }
        else {
            this.groupB.forEach((dst) => {
                this.send('attacker', dst, msg);
            });
        }
    }

    attack(packets) {
        // filter all adapted nodes' packets
        packets = packets.filter(packet => !this.byzantines.has(packet.src));
        if (packets.length === 0) return [];
        const msg = packets[0].content;
        // leader is adaptive
        // do not send the fast msg
        if (msg.type === 'fast') return [];
        // collect propose msg
        if (msg.type === 'init') {
            this.proposes.push(msg);
            if (this.proposes.length === config.nodeNum) {
                this.proposes.sort((a, b) => {
                    return a.y - b.y;
                });
                const normalMsg = [];
                this.bestMsg = [];
                for (let i = 0; i < this.proposes.length; i++) {
                    if (i < this.f) {
                        this.bestMsg.push(this.proposes[i]);
                        this.byzantines.push(this.proposes[i].sender);
                    }
                    else {
                        normalMsg.push(this.proposes[i]);
                    }
                }
                normalMsg.forEach((msg) => {
                    for (let nodeID = 1; nodeID <= config.nodeNum; nodeID++) {
                        if (nodeID === msg.sender) continue;
                        this.send('attacker', '' + nodeID, msg);
                    }
                });
                // send first best msg to group A
                this.bestMsg = this.bestMsg.reverse();
                this.groupA.forEach((dst) => {
                    this.sendIndex[dst]++;
                    if (dst === this.bestMsg[0].sender) return;
                    this.send('attacker', dst, this.bestMsg[0]);
                });
            }
            // strongly-adaptive: block init msg
            return [];
        }
        if (msg.type === 'pre-com' && msg.iter >= 1) {
            // after a node pre-commit, send a better propose
            if (this.sendIndex[msg.sender] >= this.bestMsg.length) {
                return packets;
            }
            const betterMsg = this.bestMsg[this.sendIndex[msg.sender]];
            this.send('attacker', msg.sender, betterMsg);
            this.sendIndex[msg.sender]++;
            return packets;
        }

        return packets;
    }

    constructor(transfer, registerTimeEvent) {
        super(transfer, registerTimeEvent);
        this.f = (config.nodeNum % 3 === 0) ?
            config.nodeNum / 3 - 1 : Math.floor(config.nodeNum / 3);
        this.groupA = [];
        this.groupB = [];
        this.sendIndex = {};
        for (let nodeID = 1; nodeID <= config.nodeNum; nodeID++) {
            if (nodeID <= config.nodeNum / 2) this.groupA.push('' + nodeID);
            else this.groupB.push('' + nodeID);
            this.sendIndex['' + nodeID] = 0;
        }
        this.byzantines = [];
        this.proposes = [];
    }
}

module.exports = AdaptiveAttacker;
