'use strict';

const config = require('../config');
const Attacker = require('./attacker');
// create a partition between f and f + 1 non-Byzantine nodes
class Partitioner extends Attacker {

	updateParam() {
		this.isPartitionResolved = false;
		this.registerTimeEvent(
			{ name: 'resolvePartition' }, 
			this.partitionResolveTime * 1000
		);
		return false;
	}

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

	getPartition(nodeID) {
		if (this.p1.has(nodeID)) return '1';
		else if (this.p2.has(nodeID)) return '2';
		else return '3';
	}

	attack(packets) {
		if (this.isPartitionResolved) return packets;	
		packets.forEach((packet) => {
			const srcPartition = this.getPartition(packet.src);
			const dstPartition = this.getPartition(packet.dst);
			if (srcPartition !== dstPartition) {
				packet.delay = this.getDelay(
					this.partitionDelay.mean, 
					this.partitionDelay.std
				);
			}
		});
		return packets;
	}

	triggerTimeEvent(timeEvent) {
		this.info[0] = 'Partition resolved!';
		this.isPartitionResolved = true;
	}

	constructor(transfer, registerTimeEvent) {
		super(transfer, registerTimeEvent);
		this.partitionResolveTime = 60;
		this.partitionDelay = { mean: 4, std: 1 };
		this.isPartitionResolved = false;

		const correctNodeNum = config.nodeNum - config.byzantineNodeNum;
		const boundary = Math.floor(correctNodeNum / 3);
		const boundary2 = 2 * Math.floor(correctNodeNum / 3);
		this.p1 = [];
		this.p2 = [];
		this.p3 = [];
		for (let nodeID = 1; nodeID <= correctNodeNum; nodeID++) {
			if (nodeID <= boundary) {
				this.p1.push('' + nodeID);
			}
			else if (nodeID <= boundary2) {
				this.p2.push('' + nodeID);
			}
			else {
				this.p3.push('' + nodeID);
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
