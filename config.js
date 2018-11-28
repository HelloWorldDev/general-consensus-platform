module.exports = {
	// node
	nodeNum: 16,
	byzantineNodeNum: 4,
	lambda: 1,
	BAType: 'dexon-ba',
	// network env
	networkType: 'tcp',
	host: 'localhost',
	port: 36251,
	networkDelay: 1,
	startDelay: 0,
	// simulator
	showDashboard: false,
	// attacker
	attacker: 'attacker'
};
/* fast todo
	1. pbft
	2. cachin ba
	4. system calculate time reach consensus
	5. system calculate message number
*/