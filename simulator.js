'use strict';

const { fork, spawn } = require('child_process');
const path = require('path');
const Logger = require('./lib/logger');
const Dashboard = require('./lib/dashboard');
const config = require('./config');
const Network = require('./network/network');
const NetworkInterface = require('./lib/network-interface');
const FastPriorityQueue = require('fastpriorityqueue');
const Node = require(`./ba-algo/${config.BAType}.js`);
const math = require('mathjs');

class Simulator {

    // judge calculates result, updates system info and restarts progress
    judge() {
        for (let nodeID = 1; nodeID <= this.correctNodeNum; nodeID++) {
            if (this.infos['' + nodeID] === undefined ||
                this.infos['' + nodeID].isDecided.s === 'false') {
                // some correct node has not decided
                return;
            }
        }
        // check result
        if (this.isAllDecided) {
            return;
        }
        this.isAllDecided = true;
        this.repeatTime++;
        const finalStates = [];
        for (let nodeID in this.infos) {
            if (nodeID === 'system' || nodeID === 'attacker') {
                continue;
            }
            if (parseInt(nodeID) <= this.correctNodeNum) {
                finalStates.push({ 
                    decidedValue: this.infos[nodeID].decidedValue.s,
                    round: parseInt(this.infos[nodeID].round.s)
                });
            }
        }
        const agreementPass = (finalStates.length === this.correctNodeNum) &&
            (finalStates.every(state => state.decidedValue === finalStates[0].decidedValue));
        if (!agreementPass) process.exit(0);
        const maxRound = finalStates.map(state => state.round).max();
        const timeSpent = Date.now() - this.network.startTime;
        this.infos.system[0] = `test #${this.repeatTime}, ` +
            `agreementPass: ${agreementPass}, ` + 
            `maxRound: ${maxRound}, ` + 
            `latency: ${this.clock} ms, ` +
            `totalMsgCount: ${this.network.totalMsgCount}, ` + 
            `totalMsgBytes: ${Math.round(this.network.totalMsgBytes / 1000)} kb`;
        console.log(this.infos.system[0]);
        console.log(this.network.msgCount);
        
        this.simulationResults.push({
            latency: this.clock,
            msgBytes: this.network.totalMsgBytes,
            msgCount: this.network.msgCount
        });
        // kill all child processes
        if (this.network.attacker.updateParam() || 
            (this.repeatTime < config.repeatTime)) {
            for (let nodeID in this.nodes) {
                this.nodes[nodeID].destroy();
            }
            this.nodes = {};
            this.network.removeNodes();
            this.infos = {
                system: ['No system information.']
            };
            this.dashboard.infos = this.infos;
            this.isAllDecided = false;
            this.eventQ = new FastPriorityQueue((eventA, eventB) => {
                return eventA.time < eventB.time;
            });
            this.clock = 0;
            this.startSimulation();
        }
        else {
            const p = (n, digit) => {
                digit = digit || 1;
                return Math.round(n / digit);
            };
            const l = this.simulationResults.map(result => result.latency);
            const m = this.simulationResults.map(result => result.msgBytes);
            console.log(`latency: (${p(math.mean(l), 1)}, ${p(math.std(l), 1)})`);
            console.log(`msgBytes: (${p(math.mean(m), 1000)}, ${p(math.std(m), 1)})`);
            const msgTypes = [];
            this.simulationResults.forEach(result => {
                for (const key in result.msgCount) {
                    if (!msgTypes.has(key)) msgTypes.push(key);
                }
            });
            msgTypes.forEach(type => process.stdout.write(type + ',,'));
            console.log();
            msgTypes.forEach(type => {
                const msgCounts = [];
                this.simulationResults.forEach(result => {
                    if (result.msgCount[type] === undefined) msgCounts.push(0);
                    else msgCounts.push(result.msgCount[type]);
                });
                //console.log(`${type} ${math.mean(msgCounts)} ${math.std(msgCounts)}`);
                process.stdout.write(`${p(math.mean(msgCounts))},${p(math.std(msgCounts))},`);
            });
        }
        /*
        if (!this.childKillSent) {
            for (let nodeID in this.nodes) {
                this.nodes[nodeID].kill();
            }
            this.childKillSent = true;
            const t = setInterval(() => {
                for (let nodeID in this.nodes) {
                    if (!this.nodes[nodeID].killed) {
                        return;
                    }
                }
                clearInterval(t);
                if (this.network.attacker.updateParam()) {
                    
                }
            }, 1000);
        }*/
    }

    startSimulation() {
        this.simCount++;
        this.infos.system[0] = `Start simulation #${this.simCount}`;
        // fork nodes
        this.childKillSent = false;
        for (let nodeID = 1; nodeID <= this.correctNodeNum; nodeID++) {
            this.nodes['' + nodeID] = new Node(
                '' + nodeID,
                this.nodeNum,
                this.network, 
                // register time event
                (functionMeta, waitTime) => {
                    this.eventQ.add({
                        type: 'time-event',
                        functionMeta: functionMeta,
                        dst: '' + nodeID,
                        time: this.clock + waitTime
                    });
                    //console.log(`time event ${functionMeta.name} registered by node ${nodeID} at time ${this.clock + waitTime}`);                    
                }
            );
            if (nodeID === this.correctNodeNum) {
                this.network.addNodes(this.nodes);
            }
        }
        // main loop
        setInterval(() => {
            if (this.eventQ.isEmpty()) return;
            // pop events that should be processed
            const timeEvents = [];
            const attackerTimeEvents = [];
            const msgEvents = [];
            this.clock = this.eventQ.peek().time;
            while (!this.eventQ.isEmpty() &&
                this.eventQ.peek().time === this.clock) {
                const event = this.eventQ.poll();
                switch (event.type) {
                    case 'msg-event':
                        msgEvents.push(event);
                        break;
                    case 'time-event':
                        timeEvents.push(event);
                        break;
                    case 'attacker-time-event':
                        attackerTimeEvents.push(event);
                }
            }
            //console.log(`clock: ${this.clock}`);            
            // process attacker event
            attackerTimeEvents.forEach((event) => {
                this.network.attacker.triggerTimeEvent(event.functionMeta);
            });
            // send msg by msg event
            msgEvents.forEach((event) => {
                //console.log(event);
                this.nodes[event.dst].triggerMsgEvent(event.packet.content);
            });
            // trigger time event
            timeEvents.forEach((event) => {
                //console.log(event);
                this.nodes[event.dst].triggerTimeEvent(event.functionMeta);
            });
            // process all events at the same time and then judge
            this.judge();
        }, this.tick);
    }

    constructor() {
        Logger.clearLogDir();
        // dashboard
        this.infos = {
            system: ['No system information.']
        };
        this.dashboard = new Dashboard(this.infos);
        // simulator
        this.tick = 0;
        this.clock = 0;
        this.simCount = 0;
        this.nodes = {};
        this.nodeNum = config.nodeNum;
        this.byzantineNodeNum = config.byzantineNodeNum;
        this.correctNodeNum = this.nodeNum - this.byzantineNodeNum;
        this.simulationResults = [];
        this.repeatTime = 0;
        // restart
        this.childKillSent = false;
        this.eventQ = new FastPriorityQueue((eventA, eventB) => {
            return eventA.time < eventB.time;
        });
        // set up network
        this.network = new Network(
            // send to system
            (msg) => {
                this.infos[msg.sender] = msg.info;
                if (msg.sender !== 'system' && msg.sender !== 'attacker') {
                    //this.judge();
                }
                if (config.showDashboard) {
                    this.dashboard.update();
                }
            },
            // register msg event
            (packet, waitTime) => {
                this.eventQ.add({
                    type: 'msg-event',
                    packet: packet,
                    dst: packet.dst,
                    time: this.clock + waitTime
                });
                //console.log(`msg event registered by network module at time ${this.clock + waitTime}`);
                //console.log(packet.content);
            },
            // register attacker time event
            (functionMeta, waitTime) => {
                this.eventQ.add({
                    type: 'attacker-time-event',
                    functionMeta: functionMeta,
                    time: this.clock + waitTime
                });
                //console.log(`time event ${functionMeta.name} registered by attacker at time ${this.clock + waitTime}`);                                    
            }
        );
        this.startSimulation();
    }
};

process.on('uncaughtException', (err) => {
    console.log(err);
});
const s = new Simulator();





