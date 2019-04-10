'use strict';
const Logger = require('../lib/logger');
require('../lib/fp');

class Node {
    reportToSystem() {}

    triggerMsgEvent(msgEvent) {}

    triggerTimeEvent(timeEvent) {}

    send(src, dst, msg) {
        if (this.isCooling) {
            return;
        }
        if (dst !== 'system') {
            this.logger.info(['send', dst, JSON.stringify(msg)]);
        }
        const packet = {
            src: src,
            dst: dst,
            content: msg
        };
        this.network.transfer(packet);
    }

    constructor(nodeID, nodeNum, network, registerTimeEvent) {
        this.nodeID = nodeID;
        this.nodeNum = nodeNum;
        this.logger = new Logger(this.nodeID);
        this.isCooling = false;
        this.network = network;
        this.registerTimeEvent = registerTimeEvent;
        this.reportTimer = setInterval(() => {
            this.reportToSystem();
        }, 1000);
    }

    destroy() {
        clearInterval(this.reportTimer);
    }
}
module.exports = Node;