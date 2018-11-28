'use strict';
// network interface for node, system and attacker
// will switch automatically between ipc and tcp
const net = require('net');
const JSONSocket = require('./json-socket');
const config = require('../config');

class NetworkInterface {

    send(src, dst, msg) {
        const packet = {
            src: src,
            dst: dst,
            content: msg
        };
        if (config.networkType === 'ipc') {
            process.send(packet);
        }
        else if (config.networkType === 'tcp') {
            this.socket.sendMessage(packet);
        }
    }
    close() {
        if (config.networkType === 'tcp') {
            this.socket._socket.destroy();
        }
    }

    constructor(ID, onConnected, onReceive) {
        if (config.networkType === 'ipc') {
            process.on('message', (msg) => {
                onReceive(msg);
            });
        }
        else if (config.networkType === 'tcp') {
            this.socket = new JSONSocket(new net.Socket());
            this.socket.connect(config.port, config.host);
            this.socket.on('connect', () => {
                this.socket.on('message', function(msg) {
                    //console.log(msg);
                    onReceive(msg);
                });
                // ready
                this.send(ID, 'network', {
                    'init': 'network init'
                });
                if (onConnected) {
                    onConnected();
                }
            });
            this.socket.on('error', (e) => {
                console.log(e);
            });
        }
    }
}

module.exports = NetworkInterface;