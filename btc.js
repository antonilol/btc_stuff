const { execSync } = require('child_process');

function btc(...args) {
	var o = execSync('bitcoin-cli -testnet ' + args.map(x => {
		const s = JSON.stringify(x);
		if (typeof x == 'object') {
			return JSON.stringify(s);
		}
		return s;
	}).join(' ')).toString();

	while (o.endsWith('\n')) {
		o = o.slice(0, -1);
	}
	return o;
}

// sign, create and send new transaction
function newtx(inputs, outputs) {
	const tx = btc('createrawtransaction', inputs, outputs);
	const signed = JSON.parse(btc('signrawtransactionwithwallet', tx)).hex;
	const newtxid = JSON.parse(btc('decoderawtransaction', tx)).txid;
	return send(signed);
}

function send(hex) {
	return btc('sendrawtransaction', hex);
}

function listunspent(conf) {
	if (conf == undefined) {
		return JSON.parse(btc('listunspent'))
	}
	return JSON.parse(btc('listunspent', conf));
}

module.exports = { btc, newtx, send, listunspent };
