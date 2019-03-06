'use strict';

const config = require('../config');
const Attacker = require('./attacker');
// create a partition between f and f + 1 non-Byzantine nodes
class Partitioner extends Attacker {

	attack(packets) {
		if (this.isPartitionResolved) return packets;
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

	constructor(network) {
		super(network);
		this.partitionResolveTime = 20;
		this.partitionDelay = 20;
		this.isPartitionResolved = false;
		this.delay = this.partitionDelay;

		const correctNodeNum = config.nodeNum - config.byzantineNodeNum;
		const boundary = Math.floor(correctNodeNum / 2);
		this.p1 = [];
		this.p2 = [];
		for (let nodeID = 1; nodeID <= correctNodeNum; nodeID++) {
			if (nodeID <= boundary) {
				this.p1.push('' + nodeID);
			}
			else {
				this.p2.push('' + nodeID);
			}
		}
		this.info[0] = `Partitioning boundary ${boundary}` +
			` with delay ${this.partitionDelay}s`;
		setTimeout(() => {
			this.info[0] = 'Partition resolved!';
			this.isPartitionResolved = true;
		}, this.partitionResolveTime * 1000);
	}
}

module.exports = Partitioner;
