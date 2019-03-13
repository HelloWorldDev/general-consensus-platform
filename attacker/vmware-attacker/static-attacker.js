'use strict';
// implement static attack for VMware BA
const config = require('../../config');
const Attacker = require('../attacker');

class StaticAttacker extends Attacker {

    attack(packets) {
        return packets.filter(packet => {
            return !this.byzantines.has(packet.src);
        });
    }

    constructor(transfer, registerTimeEvent) {
        super(transfer, registerTimeEvent);
        this.byzantines = [];
        const maxByzantineNodeNum = (config.nodeNum % 3 === 0) ?
            config.nodeNum / 3 - 1 : Math.floor(config.nodeNum / 3);
		for (let nodeID = 2; nodeID <= maxByzantineNodeNum + 1; nodeID++) {
			this.byzantines.push('' + nodeID);
        }
        console.log(this.byzantines);
    }
}

module.exports = StaticAttacker;
