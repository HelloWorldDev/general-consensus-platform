'use strict';
// implement network by IPC
const config = require('../config');
const Attacker = (config.attacker) ?
    require('../attacker/' + config.attacker) : undefined;

class Network {

    transfer(packet) {
        if (packet.dst === 'system') {
            this.sendToSystem(packet.content);
            return;
        }
        let packets = [];
        packet.delay = Math.random() * config.networkDelay;
        // add delay according to config
        if (packet.dst === 'broadcast') {
            for (let nodeID in this.nodes) {
                if (nodeID === packet.src) {
                    continue;
                }
                packet.dst = nodeID;
                packets.push(JSON.parse(JSON.stringify(packet)));
            }
        }
        else if (this.nodes[packet.dst] !== undefined) {
            packets.push(packet);
        }
        // attacker attack function
        if (Attacker !== undefined &&
            packet.src !== 'system' && packet.dst !== 'system' &&
            packet.src !== 'attacker' && packet.dst !== 'attacker') {
            packets = this.attacker.attack(packets);
        }
        // send packets
        packets.forEach((packet) => {
            setTimeout(() => {
                this.nodes[packet.dst].send(packet.content);
            }, packet.delay * 1000);
        });
    }

    removeNodes() {
        this.nodes = {};
    }

    addNodes(nodes) {
        this.nodes = nodes;
        for (let nodeID in this.nodes) {
            this.nodes[nodeID].on('message', (packet) => {
                this.transfer(packet);     
            });
        }
    }

    constructor(onCreated, sendToSystem) {
        this.sendToSystem = sendToSystem;
        if (Attacker !== undefined) {
            this.attacker = new Attacker(this);
        }
        onCreated();
    }
}

module.exports = Network;