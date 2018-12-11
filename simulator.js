'use strict';

const { fork, spawn } = require('child_process');
const path = require('path');
const Logger = require('./lib/logger');
const Dashboard = require('./lib/dashboard');
const config = require('./config');
const Network = require('./network/network-' + config.networkType);
const NetworkInterface = require('./lib/network-interface');

process.on('uncaughtException', (err) => {
    console.log(err);
});
// clean log directory
Logger.removeLogDir();
// dashboard
let infos = {
    system: ['No system information.']
};
const dashboard = new Dashboard(infos);
// judge calculates result, updates system info and restarts progress
function judge() {
    for (let nodeID = 1; nodeID <= correctNodeNum; nodeID++) {
        if (infos['' + nodeID] === undefined ||
            infos['' + nodeID].isDecided.s === 'false') {
            // some correct node has not decided
            return;
        }
    }
    // kill all child processes
    if (!childKillSent) {
        for (let nodeID in nodes) {
            nodes[nodeID].kill();
        }
        childKillSent = true;
        const t = setInterval(() => {
            for (let nodeID in nodes) {
                if (!nodes[nodeID].killed) {
                    return;
                }
            }
            clearInterval(t);
            if (network.attacker.updateParam()) {
                nodes = {};
                network.removeNodes();
                infos = {
                    system: ['No system information.']
                };
                dashboard.infos = infos;
                startSimulation();
            }
        }, 1000);
    }
}
function startSimulation() {
    simCount++;
    infos.system[0] = `Start simulation #${simCount}`;
    // fork nodes
    childKillSent = false;
    if (config.useExternalBA) {
        // modify this to run external BA algorithms
    }
    else {
        const nodeProgram = path.resolve(`./ba-algo/${config.BAType}.js`);
        for (let nodeID = 1; nodeID <= correctNodeNum; nodeID++) {
            setTimeout(() => {
                let node = fork(nodeProgram, ['' + nodeID, nodeNum]);
                nodes[nodeID] = node;
                if (nodeID === correctNodeNum) {
                    network.addNodes(nodes);
                }
            }, nodeID * config.startDelay * 1000);
        }
    }
}
let simCount = 0;
let nodes = {};
const nodeNum = config.nodeNum;
const byzantineNodeNum = config.byzantineNodeNum;
const correctNodeNum = nodeNum - byzantineNodeNum;
// restart
let childKillSent = false;
// set up network
const network = new Network(
    // on created
    () => {
        console.log('Network is created');
        startSimulation();
    },
    // send to system
    (msg) => {
        infos[msg.sender] = msg.info;
        judge();
        if (config.showDashboard) {
            dashboard.update();
        }
    }
);
