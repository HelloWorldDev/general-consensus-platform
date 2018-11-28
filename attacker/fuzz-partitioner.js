'use strict';

const config = require('../config');
const Attacker = require('./attacker');
// fuzz partition between 0 and 2f + 1 non-Byzantine nodes
class FuzzPartitioner extends Attacker {

	attack(packets) {
		packets.forEach((packet) => {
			if ((this.p1.includes(packet.src) && 
				this.p2.includes(packet.dst)) ||
				(this.p2.includes(packet.src) && 
				this.p1.includes(packet.dst))) {
				packet.delay = this.delay;
			}
		});
		return packets;
	}

	updateParam() {
		if (this.boundary === this.correctNodeNum) {
			return false;
		}
		this.delay = this.partitionDelay;
		this.correctNodeNum = config.nodeNum - config.byzantineNodeNum;
		this.boundary++;
		this.p1 = [];
		this.p2 = [];
		for (let nodeID = 1; nodeID <= this.correctNodeNum; nodeID++) {
			if (nodeID <= this.boundary) {
				this.p1.push('' + nodeID);
			}
			else {
				this.p2.push('' + nodeID);
			}
		}
		this.delay = this.partitionDelay;
		let countDown = this.partitionResolveTime;
		const timer = setInterval(() => {
			if (countDown === 0) {
				this.info[0] = 'Partition resolved!';
				this.delay = this.normalDelay;
				clearInterval(timer);
				return;
			}
			this.info[0] = `Partitioning boundary ${this.boundary}` +
				` resolves in ${countDown}s`;
			countDown--;
		}, 1000);
		return true;
	}

	constructor(network) {
		super(network);
		this.partitionResolveTime = 8;
		this.partitionDelay = 8;
		this.normalDelay = config.networkDelay;
		
		this.boundary = 0;
		this.updateParam();
	}
}

module.exports = FuzzPartitioner;