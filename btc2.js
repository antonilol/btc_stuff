const bitcoin = require('bitcoinjs-lib');

function bech32toLockingScript(a) {
	return Buffer.from('0014' + bitcoin.address.fromBech32(a).data.toString('hex'), 'hex');
}

module.exports = { bech32toLockingScript };
