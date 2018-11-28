'use strict';
require('../lib/fp');

class Attacker {

    updateParam() {
        return false;
    }

    attack(packets) {
        return packets;
    }

    reportToSystem() {
        this.send('attacker', 'system', {
            sender: 'attacker',
            info: this.info
        });
    }

    send(src, dst, msg) {
        const packet = {
            src: src,
            dst: dst,
            content: JSON.parse(JSON.stringify(msg))
		};
		this.network.transfer(packet);
    }

    constructor(network) {
        this.network = network;
        this.info = ['No attacker information.'];
        setInterval(() => {
            this.reportToSystem();
        }, 1000);
    }
}
module.exports = Attacker;