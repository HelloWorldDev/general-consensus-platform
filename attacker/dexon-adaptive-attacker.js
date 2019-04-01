'use strict';
// implement adaptive attack for DEXON HBA
const config = require('../config');
const Attacker = require('attacker');

class AdaptiveAttacker extends Attacker {

    updateParam() {
        this.byzantines = [];
        return false;
    }

    attack(packets) {
        const msg = packets[0].content;
        // leader is adaptive
        // do not send the fast msg
        if (msg.type === 'fast') return [];
        // collect propose msg
        if (msg.type === 'init') {
            this.proposes.push(msg);
            if (this.proposes.length === config.nodeNum) {
                const bestProposal = this.proposes.minBy(msg => msg.y);
                console.log(bestProposal);
                // adapt leader
                if (this.byzantines.has(bestProposal.sender)) {
                    //console.log('lucky VRF');
                }
                else if (this.byzantines.length < this.f) {
                    //console.log('adapting: ', bestProposal.sender);
                    this.byzantines.push(bestProposal.sender);
                }
                // send fork value
                if (this.byzantines.has(bestProposal.sender)) {
                    const forkProposeMsg = JSON.parse(JSON.stringify(bestProposal));
                    forkProposeMsg.value = 'x'.repeat(32);
                    // broadcast to half of the honest nodes
                    for (let nodeID = 1; nodeID <= (config.nodeNum / 2); nodeID++) {
                        packets.push({
                            src: bestProposal.sender,
                            dst: '' + nodeID,
                            content: forkProposeMsg,
                            delay: 0
                        });
                    }
                }
                this.proposes = [];
            }
        }
        return packets;
    }

    constructor(transfer, registerTimeEvent) {
        super(transfer, registerTimeEvent);
        this.f = (config.nodeNum % 3 === 0) ?
            config.nodeNum / 3 - 1 : Math.floor(config.nodeNum / 3);
        // adapt fast mode leader
        this.byzantines = ['1'];
        this.proposes = [];
    }
}

module.exports = AdaptiveAttacker;
