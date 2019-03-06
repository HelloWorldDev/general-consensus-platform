'use strict';
// implement network that pass JSON object
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
        //const delay = get01BM() * std + mean;
        const delay = mean;
        return (delay < 0) ? 0 : delay;
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
        /*
        if (packet.dst !== 'broadcast' &&
            this.availableDst.has(packet.dst) &&
            this.sockets[packet.dst] === undefined) {
            this.queue.push(packet);
            return;
        }*/
        let packets = [];
        packet.delay = 
            this.getDelay(config.networkDelay.mean, config.networkDelay.std);
        // add delay according to config
        if (packet.dst === 'broadcast') {
            for (let nodeID of this.availableDst) {
                if (nodeID === packet.src) {
                    continue;
                }
                packet.delay = 
                    this.getDelay(config.networkDelay.mean, config.networkDelay.std);        
                packet.dst = nodeID;
                packets.push(JSON.parse(JSON.stringify(packet)));
            }
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
            /*
            const waitTime = 
                packet.delay * 1000 - (Date.now() - packet.content.sendTime);
                
            this.timers.push(setTimeout(() => {
                //console.log(Date.now() - packet.content.sendTime);
                this.sockets[packet.dst].sendMessage(packet.content);
            }, waitTime));*/
            this.registerMsgEvent(packet, packet.delay * 1000);
        });
    }

    removeNodes() {
        this.totalMsgCount = 0;
        this.totalMsgBytes = 0;
        this.init = true;
    }
    addNodes(nodes) {
        for (let nodeID in nodes) {
            this.availableDst.push(nodeID);
        }
    }

    constructor(sendToSystem, registerMsgEvent, registerAttackerTimeEvent) {
        this.sendToSystem = sendToSystem;
        this.registerMsgEvent = registerMsgEvent;
        if (Attacker !== undefined) {
            this.attacker = new Attacker(
                (packet) => this.transfer(packet),
                registerAttackerTimeEvent
            );
        }
        this.totalMsgCount = 0;
        this.totalMsgBytes = 0;
        this.init = true;
        this.availableDst = [];        
    }
    /*



        this.timers = [];
        this.sockets = {};
        this.queue = [];
        
        const server = net.createServer();
        
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
    }*/
}

module.exports = Network;
//const n = new Network();
