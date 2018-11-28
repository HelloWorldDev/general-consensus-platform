'use strict';
const Attacker = require('./attacker');
const config = require('../config');
const uuid = require('uuid/v4');

class NoValidate extends Attacker {

    attack(packets) {
        //console.log(packets);
        // intercept every init of round 2 msg
        const retPackets = [];
        packets.forEach((packet) => {
            const content = packet.content;
            if (content.type === 'init') {
                const round = content.v.k % 3;
                const phase = (content.v.k - round) / 3;
                if (round === 2 && packet.src <= this.correctNodeNum) {
                    // Since round 1 judges on majority,
                    // all value should be the same.
                    if (!this.attacking) {
                        this.info[0] = 
                            `capturing packet from phase ${phase} round ${round}`;
                        this.queue.push(packet);
                    }
                    else {
                        retPackets.push(packet);
                        this.releasePacketCount++;
                        if (this.releasePacketCount === this.queue.length) {
                            this.releasePacketCount = 0;
                            this.queue = [];
                            const k = content.v.k;
                            this.info[0] = 
                                `all packets from phase ${phase} round ${round} are released`;
                            this.attacking = false;
                        }
                    }
                }
                else {
                    retPackets.push(packet);
                }
            }
            else {
                retPackets.push(packet);
            }
        });
        if (!this.attacking &&
            this.queue.length === 
            this.correctNodeNum * (this.correctNodeNum - 1)) {
            this.attacking = true;
            // all init msg of round 2 is collected
            // see what value a non-Byzantine propose
            const nbv = this.queue[0].content.v.value;
            const k = this.queue[0].content.v.k;
            const round = k % 3;
            const phase = (k - round) / 3;
            // propose a different value to make them diverge
            const bv = 1 - nbv;
            this.info[0] = `non-Byzantine nodes proposed: ${nbv}, ` + 
                `attacker proposed: ${bv}`;
            for (let attackerID = this.correctNodeNum + 1; 
                attackerID <= config.nodeNum; attackerID++) {
                this.reportNodeToSystem('' + attackerID, '' + bv);
                const v = {
                    k: k,
                    sender: '' + attackerID,
                    value: bv,
                    ID: uuid()
                };
                const content = {
                    type: 'init',
                    sender: '' + attackerID,
                    v: v
                };
                // broadcast to non-Byzantine
                for (let dst = 1; dst <= this.correctNodeNum; dst++) {
                    this.send('' + attackerID, '' + dst, content);
                }
            }
            // release packets from non-Byzantine nodes after
            // Byzantine nodes values are accepted
            setTimeout(() => {
                this.info[0] = 
                    `releasing packets from phase ${phase} round ${round}`;                
                for (let packet of this.queue) {
                    //console.log(packet);
                    this.send(packet.src, packet.dst, packet.content);
                }
            }, 5000);
        }
        //console.log(this.queue.length);

        return retPackets;
    }
    reportNodeToSystem(nodeID, proposedValueS) {
        const info = {
            initValue: { s: 'NA', w: 15 },
            phase: { s: 'NA', w: 15 },
            round: { s: 'NA', w: 15 },
            valueP: { s: proposedValueS, w: 20 },
            isDecided: { s: 'NA', w: 15 },
            decidedValue: { s: 'NA', w: 15 }
        };
        this.send(nodeID, 'system', {
            sender: nodeID,
            info: info
        });
    }

    constructor(network) {
        super(network);
        // attack state
        this.attacking = false;
        this.releasePacketCount = 0;
        this.correctNodeNum = config.nodeNum - config.byzantineNodeNum;
        this.queue = [];
        for (let attackerID = this.correctNodeNum + 1;
            attackerID <= config.nodeNum; attackerID++) {
            this.reportNodeToSystem('' + attackerID, 'NA');
        }
    }
}
module.exports = NoValidate;