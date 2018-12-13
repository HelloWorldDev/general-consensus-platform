'use strict';
// implement adaptive attack for VMware BA
const config = require('../../config');
const Attacker = require('../attacker');

class AdaptiveAttacker extends Attacker {

    attack(packets) {
        const msg = packets[0].content;
        if (msg.type === 'fl-propose' && packets.length === 1) {
            this.propose.push(msg);
            if (this.propose.length == config.nodeNum) {
                //console.log('find best vrf except byzantines');
                this.propose = this.propose
                    .filter(msg => !this.byzantines.has(msg.sender));
                this.propose.sort((msgA, msgB) => {
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
                const bestProposal = this.propose[0];
                console.log(bestProposal);
                // adapt leader
                if (this.byzantines.has(bestProposal.sender)) {
                    console.log('lucky adapter');
                }
                else if (this.byzantines.length < this.f) {
                    console.log('adapting: ', bestProposal.sender);
                    this.byzantines.push(bestProposal.sender);
                }
                // send fork value
                if (this.byzantines.has(bestProposal.sender)) {
                    const forkProposeMsg = JSON.parse(JSON.stringify(bestProposal));
                    forkProposeMsg.proposeMsg.vL = 'a forked value';
                    // broadcast to some of the honest nodes
                    for (let nodeID = 1; nodeID <= 5; nodeID++) {
                        packets.push({
                            src: bestProposal.sender,
                            dst: '' + nodeID,
                            content: forkProposeMsg,
                            delay: 0
                        });
                    }
                }
                this.propose = [];
            }
        }
        return packets;
    }

    constructor(network) {
        super(network);
        this.f = (config.nodeNum % 3 === 0) ?
            config.nodeNum / 3 - 1 : Math.floor(config.nodeNum / 3);
        this.propose = [];
        this.byzantines = [];
        this.mode = 'vrf';
    }
}

module.exports = AdaptiveAttacker;
