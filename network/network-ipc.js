'use strict';
// implement network by IPC
const config = require('../config');
const Attacker = (config.attacker) ?
    require('../attacker/' + config.attacker) : undefined;

class Network {

    getDelay(mean, std) {
        function get01BM() {
            let u = 0, v = 0;
            while (u === 0) u = Math.random();
            while (v === 0) v = Math.random();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        }
        return get01BM() * std + mean;
    }

    transfer(packet) {
        if (packet.dst === 'system') {
            this.sendToSystem(packet.content);
            return;
        }
        if (this.init) {
            this.startTime = Date.now();
            this.init = false;
        }
        let packets = [];
        packet.delay = 
            this.getDelay(config.networkDelay.mean, config.networkDelay.std);
        // add delay according to config
        if (packet.dst === 'broadcast') {
            for (let nodeID in this.nodes) {
                if (nodeID === packet.src) {
                    continue;
                }
                packet.delay =
                    this.getDelay(config.networkDelay.mean, config.networkDelay.std);
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
            // filter unavailable dst packets
            packets = packets
                .filter(packet => this.availableDst.has(packet.dst));
        }
        this.totalMsgCount += packets.length;
        this.totalMsgBytes += packets.reduce(
            (sum, packet) => sum + JSON.stringify(packet.content).length, 0);
        // send packets
        packets.forEach((packet) => {
            this.timers.push(setTimeout(() => {
                this.nodes[packet.dst].send(packet.content);
            }, packet.delay * 1000));
        });
    }

    removeNodes() {
        this.nodes = {};
        this.totalMsgCount = 0;
        this.totalMsgBytes = 0;
        this.init = true;
        this.timers.forEach(clearTimeout);
        this.timers = [];
    }

    addNodes(nodes) {
        this.nodes = nodes;
        for (let nodeID in this.nodes) {
            this.nodes[nodeID].on('message', (packet) => {
                this.transfer(packet);
            });
            this.availableDst.push(nodeID);
        }
    }

    constructor(onCreated, sendToSystem) {
        this.sendToSystem = sendToSystem;
        this.availableDst = [];
        this.timers = [];
        this.totalMsgCount = 0;
        this.totalMsgBytes = 0;
        this.init = true;
        if (Attacker !== undefined) {
            this.attacker = new Attacker(this);
        }
        onCreated();
    }
}

module.exports = Network;
