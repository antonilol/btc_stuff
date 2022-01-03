const bitcoin = require('bitcoinjs-lib');

function bech32toScriptPubKey(a) {
	return bitcoin.script.compile([
		// witness v0 (20 bytes: P2WPKH, 32 bytes: P2WSH)
		bitcoin.opcodes.OP_0,
		bitcoin.address.fromBech32(a).data
	]);
}

module.exports = { bech32toScriptPubKey };
