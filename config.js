module.exports = {
	// node
	nodeNum: 16,
	byzantineNodeNum: 0,
	// ba
	useExternalBA: false,
	// ba specific param
	lambda: 1,
	BAType: 'aba',
	configPath: '/Users/nicky/general-consensus-platform/tendermint/mytestnet/node',
	// network env
	networkType: 'tcp-json',
	host: 'localhost',
	port: 36251,
	networkDelay: {
		mean: 4,
		std: 1
	},
	startDelay: 0,
	// simulator
	showDashboard: false,
	// attacker
	attacker: 'attacker',
	// repeat
	repeatTime: 10
};
/* fast todo
	2. cachin ba
*/
