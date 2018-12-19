module.exports = {
	// node
	nodeNum: 16,
	byzantineNodeNum: 0,
	// ba
	useExternalBA: false,
	// ba specific param
	lambda: 1,
	BAType: 'vmware-ba/adaptive',
	configPath: '/Users/nicky/general-consensus-platform/tendermint/mytestnet/node',
	// network env
	networkType: 'tcp-json',
	host: 'localhost',
	port: 36251,
	networkDelay: 0.25,
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