'use strict';
require('../lib/fp');
const config = require('../config');

class Attacker {

    updateParam() {
        this.repeatTime++;
        if (config.controlRepeat && 
            this.repeatTime === config.repeatTime) {
            return false;
        }
        return (config.controlRepeat) ? true : false;
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
		this.transfer(packet);
    }

    triggerTimeEvent() {}

    constructor(transfer, registerTimeEvent) {
        this.transfer = transfer;
        this.registerTimeEvent = registerTimeEvent;
        this.info = ['No attacker information.'];
        this.repeatTime = 0;
        setInterval(() => {
            this.reportToSystem();
        }, 1000);
    }
}
module.exports = Attacker;