const { spawn } = require('child_process');
const bitcoin = require('bitcoinjs-lib');

var chain = 'test';

function btc(...args) {
	return new Promise((r, e) => {
		const p = spawn('bitcoin-cli', [ `-chain=${chain}`, '-stdin' ]);

		var out = '';

		p.stdout.setEncoding('utf8');
		p.stdout.on('data', data => out += data.toString());

		p.stderr.setEncoding('utf8');
		p.stderr.on('data', data => out += data.toString());

		p.on('close', code => {
			while (out.endsWith('\n')) {
				out = out.slice(0, -1);
			}
			(code ? e : r)(out);
		});

		p.stdin.write(args.map(x => {
			if (typeof x === 'object') {
				return JSON.stringify(x);
			}
			return x.toString().replaceAll('\n', '');
		}).join('\n'));
		p.stdin.end();
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
	return send(signed);
}

function send(hex) {
	return btc('sendrawtransaction', hex);
}

async function listunspent(minamount=0, minconf=1, sat=false) {
	return JSON.parse(await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`)).map(u => {
		if (sat) {
			u.amount = Math.round(u.amount * 1e8);
		}
		return u;
	});
}

function getnewaddress() {
	return btc('getnewaddress');
}

function bech32toScriptPubKey(a) {
	const z = bitcoin.address.fromBech32(a);
	return bitcoin.script.compile([
		bitcoin.script.number.encode(z.version),
		bitcoin.address.fromBech32(a).data
	]);
}

function setChain(c) {
	chain = c;
}

module.exports = { btc, newtx, send, listunspent, getnewaddress, bech32toScriptPubKey, setChain };
