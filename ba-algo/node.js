'use strict';
const Logger = require('../lib/logger');
const NetworkInterface = require('../lib/network-interface');
require('../lib/fp');

class Node {
    reportToSystem() {}
    receive(msg) {}

    send(src, dst, msg) {
        if (this.isCooling) {
            return;
        }
        if (dst !== 'system') {
            this.logger.info(['send', dst, JSON.stringify(msg)]);
        }
        this.network.send(src, dst, msg);
    }

    constructor(nodeID, nodeNum) {
        process.on('uncaughtException', (err) => {
            console.log(err);
        });
        this.nodeID = nodeID;
        this.nodeNum = nodeNum;

        this.logger = new Logger(this.nodeID);
        
        this.isCooling = false;
        this.network = new NetworkInterface(this.nodeID, undefined, (msg) => {
            this.receive(msg);
        });
        setInterval(() => {
            this.reportToSystem();
        }, 1000);
        process.on('SIGTERM', () => {
            this.isCooling = true;
            // close after 1 sec
            setTimeout(() => {
                this.network.close();
                process.exit(0);
            }, 1000);
        });
    }
}
module.exports = Node;