'use strict';

const config = require('../config');
const Attacker = require('./attacker');

class Procrastinator extends Attacker {

    createNextMsg(msg) {
        msg.sender = '' + (parseInt(msg.sender) + 1);
        msg.value = '' + (parseInt(msg.value) - 1);
    }

    sendMsgToVictim() {
        this.send(this.msgToVictim.sender, '1', this.msgToVictim);
        this.createNextMsg(this.msgToVictim);
    }

    sendMsgToOthers() {
        for (let nodeID = 2; nodeID <= 11; nodeID++) {
            this.send(this.msgToOthers.sender, '' + nodeID, this.msgToOthers);
        }
        this.createNextMsg(this.msgToOthers);
    }

    reportNodeToSystem(nodeID) {
        const node = this.nodes[nodeID];
        const precommitsS = (node.precommits[node.round]) ? 
            '' + node.precommits[node.round].length : '0';
        const commitsS = (node.commits[node.round]) ? 
            '' + node.commits[node.round].length : '0';
        const decidedValueS = (node.decidedValue) ?
            node.decidedValue : 'NA';
        const isDecidedS = node.isDecided.toString();
        const lock = `(${node.lock.round}, ${node.lock.value})`;
        const info = {
            initValue: { s: node.initValue, w: 15 },
            round: { s: '' + node.round, w: 15 },
            precommits: { s: precommitsS, w: 15 },
            commits: { s: commitsS, w: 15 },
            isDecided: {s: isDecidedS, w: 15},            
            decidedValue: { s: decidedValueS, w: 15 },
            'lock(r, v)': { s: lock, w: 15 }
        };
        this.send(nodeID, 'system', {
            sender: nodeID,
            info: info
        });
    }

    attack(packets) {
        for (let packet of packets) {
            if (!this.start && packet.src === '1' && 
                packet.content.type === 'init') {
                //console.log(packet);
                // count lambda and send smaller value to 1
                setTimeout(() => {
                    // 1l
                    this.info[0] = 
                        `Attacker ${this.msgToVictim.sender} send ${this.msgToVictim.value} to node 1.`;
                    this.sendMsgToVictim();
                    setTimeout(() => {
                        // 4l
                        this.info[0] =
                            `Attacker ${this.msgToVictim.sender} send ${this.msgToVictim.value} to node 1.`;
                        this.sendMsgToVictim();
                        setInterval(() => {
                            // 6l, 8l...
                            if (this.msgToVictim.value >= -5) {
                                this.info[0] =
                                    `Attacker ${this.msgToVictim.sender} send ${this.msgToVictim.value} to node 1.`;
                                this.sendMsgToVictim();
                            }
                        }, 2 * config.lambda * 1000);
                    }, 3 * config.lambda * 1000);
                }, config.lambda * 1000);
                // count 3 lambda and send value to other nodes                
                setTimeout(() => {
                    // 3l
                    this.info[0] =
                        `Attacker ${this.msgToOthers.sender} send ${this.msgToOthers.value} to others.`; 
                    this.sendMsgToOthers();
                    setInterval(() => {
                        // 5l, 7l...
                        if (this.msgToOthers.value >= -5) {
                            this.info[0] =
                                `Attacker ${this.msgToOthers.sender} send ${this.msgToOthers.value} to others.`;
                            this.sendMsgToOthers(); 
                        }   
                    }, 2 * config.lambda * 1000);
                }, 3 * config.lambda * 1000);
                this.start = true;
            }
        }
        return packets;
    }

    constructor(network) {
        super(network);
        this.start = false;
        this.msgToVictim = {
            type: 'init',
            sender: '12',
            value: '-1'
        };
        this.msgToOthers = {
            type: 'init',
            sender: '12',
            value: '-1'
        };
        // store attacker nodes data
        this.nodes = {};
        const start = config.nodeNum - config.byzantineNodeNum + 1;
        for (let i = 0; i < config.byzantineNodeNum; i++) {
            const nodeID = '' + (start + i);
            this.nodes[nodeID] = {
                initValue: '' + (-1 - i),
                precommits: [],
                commits: [],
                round: 0,
                isDecided: false,
                decidedValue: '' + (-1 - i),
                lock: {
                    round: 1,
                    value: undefined
                }
            };
            this.reportNodeToSystem(nodeID);
        }
    }
}

module.exports = Procrastinator;