'use strict';
// implement DDoS attack on PBFT proposed by HoneyBadger BFT
const config = require('../config');
const Attacker = require('./attacker');

class DDoSAttacker extends Attacker {

    attack(packets) {
        const packet = packets[0];
        // DDoS on target
        if (packet.src === '' + this.target) {
            return [];
        }
        if (packet.content.type === 'new-view') {
            this.target = (packet.content.v % config.nodeNum) + 1;
            this.info[0] = 'DDoS on node ' + this.target;
        }
        return packets;
    }

    constructor(transfer, registerTimeEvent) {
        super(transfer, registerTimeEvent);
        this.target = 1;
        this.info[0] = 'DDoS on node ' + this.target;
    }
}

module.exports = DDoSAttacker;
