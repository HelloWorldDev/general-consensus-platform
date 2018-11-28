'use strict';
// implement tcp socket that pass JSON object
const JSONSocket = require('./lib/json-socket');
const net = require('net');
const config = require('./config');
const Attacker = (config.attacker) ?
    require('./attacker/' + config.attacker) : undefined;

class NetworkTCP {

    transfer(packet) {
        if (packet.dst === 'system') {
            //this.sockets['system'].sendMessage(packet.content);
            this.sendToSystem(packet.content);
            return;
        }
        if (packet.dst !== 'broadcast' && 
            this.sockets[packet.dst] === undefined) {
            this.queue.push(packet);
            return;
        }
        let packets = [];
        packet.delay = Math.random() * config.networkDelay;
        // add delay according to config
        if (packet.dst === 'broadcast') {
            for (let nodeID in this.sockets) {
                if (nodeID === packet.src || nodeID === 'system') {
                    continue;
                }
                packet.dst = nodeID;
                packets.push(JSON.parse(JSON.stringify(packet)));
            }
        }
        else if (this.sockets[packet.dst] !== undefined) {
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
                this.sockets[packet.dst].sendMessage(packet.content);
            }, packet.delay * 1000);
        });
    }

    removeNodes() {
        this.sockets = {};
    }
    addNodes(nodes) {

    }

    constructor(onCreated, sendToSystem) {
        this.sendToSystem = sendToSystem;
        this.sockets = {};     
        this.queue = [];
        const server = net.createServer();
        if (Attacker !== undefined) {
            this.attacker = new Attacker({
                transfer: (packet) => {
                    this.transfer(packet);
                }
            });
        }
        server.on('connection', (socket) => {
            socket = new JSONSocket(socket);
            socket.on('message', (packet) => {
                // network redistration
                if (packet.dst === 'network') {
                    this.sockets[packet.src] = socket;
                    return;
                }
                // every node is connected
                if (Object.keys(this.sockets).length === 
                    config.nodeNum - config.byzantineNodeNum) {
                    if (this.queue.length !== 0) {
                        for (let packet of this.queue) {
                            this.transfer(packet);
                        }
                        this.queue = [];
                    }
                    this.transfer(packet);
                }
                else {
                    this.queue.push(packet);
                }
            });
        });
        server.on('listening', () => {
            onCreated();        
        });
        server.listen(config.port, config.host);        
    }
}

module.exports = NetworkTCP;
//const n = new NetworkTCP();