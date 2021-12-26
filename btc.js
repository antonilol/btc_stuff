const { exec } = require('child_process');

function btc(...args) {
	return new Promise((r, e) => {
		exec('bitcoin-cli -testnet ' + args.map(x => {
			const s = JSON.stringify(x);
			if (typeof x == 'object') {
				return JSON.stringify(s);
			}
			return s;
		}).join(' '), { maxBuffer: 2**25 } , (err, stdout, stderr) => {
			if (err) {
				console.error('error', stdout);
				e(stderr);
				return;
			}
			while (stdout.endsWith('\n')) {
				stdout = stdout.slice(0, -1);
			}
			r(stdout);
		});
	});
}

// sign, create and send new transaction
async function newtx(inputs, outputs, sat=false) {
	if (sat) {
		Object.keys(outputs).forEach(k => {
			outputs[k] = parseFloat((outputs[k] * 1e-8).toFixed(8));
		});
	}
	const tx = await btc('createrawtransaction', inputs, outputs);
	const signed = JSON.parse(await btc('signrawtransactionwithwallet', tx)).hex;
	const newtxid = JSON.parse(await btc('decoderawtransaction', tx)).txid;
	return send(signed);
}

function send(hex) {
	return btc('sendrawtransaction', hex);
}

async function listunspent(minamount=0, minconf=1) {
	return JSON.parse(await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`));
}

function getnewaddress() {
	return btc('getnewaddress');
}

module.exports = { btc, newtx, send, listunspent, getnewaddress };
