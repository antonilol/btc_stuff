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
function newtx(inputs, outputs, sat=false) {
	if (sat) {
		Object.keys(outputs).forEach(k => {
			outputs[k] = parseFloat((outputs[k] * 1e-8).toFixed(8));
		});
	}
	const tx = btc('createrawtransaction', inputs, outputs);
	const signed = JSON.parse(btc('signrawtransactionwithwallet', tx)).hex;
	const newtxid = JSON.parse(btc('decoderawtransaction', tx)).txid;
	return send(signed);
}

function send(hex) {
	return btc('sendrawtransaction', hex);
}

function listunspent(minamount=0, minconf=1) {
	return JSON.parse(btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`));
}

function getnewaddress() {
	return btc('getnewaddress');
}

module.exports = { btc, newtx, send, listunspent, getnewaddress };
