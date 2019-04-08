'use strict';

const config = require('../config');
const Attacker = require('./attacker');
// create a partition between f and f + 1 non-Byzantine nodes
class Partitioner extends Attacker {

	getDelay(mean, std) {
		function get01BM() {
			let u = 0, v = 0;
			while (u === 0) u = Math.random();
			while (v === 0) v = Math.random();
			return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
		}
		const delay = get01BM() * std + mean;
		return (delay < 0) ? 0 : delay;
	}

	attack(packets) {
		
		if (this.isPrtitionResolved) return packets;	
		packets.forEach((packet) => {
			if ((this.p1.includes(packet.src) &&
				this.p2.includes(packet.dst)) ||
				(this.p2.includes(packet.src) &&
				this.p1.includes(packet.dst))) {
				packet.delay = this.getDelay(
					this.partitionDelay.mean, 
					this.partitionDelay.std
				);
			}
		});
		return packets;
	}

	triggerTimeEvent(functionMeta) {
		this.info[0] = 'Partition resolved!';
		this.isPrtitionResolved = true;
	}

	constructor(transfer, registerTimeEvent) {
		super(transfer, registerTimeEvent);
		this.partitionResolveTime = 60;
		this.partitionDelay = { mean: 4, std: 1 };
		this.isPrtitionResolved = false;

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
		this.registerTimeEvent(
			{ name: 'resolvePartition' }, 
			this.partitionResolveTime * 1000
		);
	}
}

module.exports = Partitioner;
