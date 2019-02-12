'use strict';

const { fork, spawn } = require('child_process');
const path = require('path');
const Logger = require('./lib/logger');
const Dashboard = require('./lib/dashboard');
const config = require('./config');
const Network = require('./network/network-' + config.networkType);
const NetworkInterface = require('./lib/network-interface');

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
        const maxRound = finalStates.map(state => state.round).max();
        const latency = Date.now() - this.network.startTime;
        this.infos.system[0] = `agreementPass: ${agreementPass}, ` + 
            `maxRound: ${maxRound}, ` + 
            `latency: ${latency} ms, ` +
            `totalMsgCount: ${this.network.totalMsgCount}, ` + 
            `totalMsgBytes: ${Math.round(this.network.totalMsgBytes / 1000)} kb`;
        console.log(this.infos.system[0]);
        // kill all child processes
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
                    this.nodes = {};
                    this.network.removeNodes();
                    this.infos = {
                        system: ['No system information.']
                    };
                    this.dashboard.infos = this.infos;
                    this.isAllDecided = false;
                    this.startSimulation();
                }
            }, 1000);
        }
    }

    startSimulation() {
        this.simCount++;
        this.infos.system[0] = `Start simulation #${this.simCount}`;
        // fork nodes
        this.childKillSent = false;
        if (config.useExternalBA) {
            // modify this to run external BA algorithms
        }
        else {
            const targetStartTimeBase = Date.now() + 4000;
            const nodeProgram = path.resolve(`./ba-algo/${config.BAType}.js`);
            for (let nodeID = 1; nodeID <= this.correctNodeNum; nodeID++) {
                const targetStartTime = 
                    targetStartTimeBase + nodeID * config.startDelay * 1000;
                let node = fork(nodeProgram, 
                    ['' + nodeID, this.nodeNum, targetStartTime]);
                this.nodes[nodeID] = node;
                if (nodeID === this.correctNodeNum) {
                    this.network.addNodes(this.nodes);
                }
            }
        }
    }

    constructor() {
        Logger.clearLogDir();
        // dashboard
        this.infos = {
            system: ['No system information.']
        };
        this.dashboard = new Dashboard(this.infos);
        // simulator
        this.simCount = 0;
        this.nodes = {};
        this.nodeNum = config.nodeNum;
        this.byzantineNodeNum = config.byzantineNodeNum;
        this.correctNodeNum = this.nodeNum - this.byzantineNodeNum;
        // restart
        this.childKillSent = false;
        // set up network
        this.network = new Network(
            // on created
            () => {
                console.log('Network is created');
                this.startSimulation();
            },
            // send to system
            (msg) => {
                this.infos[msg.sender] = msg.info;
                if (msg.sender !== 'system' && msg.sender !== 'attacker') {
                    this.judge();
                }
                if (config.showDashboard) {
                    this.dashboard.update();
                }
            }
        );
    }
};

process.on('uncaughtException', (err) => {
    console.log(err);
});
const s = new Simulator();





