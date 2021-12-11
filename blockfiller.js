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
	return btc('sendrawtransaction', signed);
}

console.log('Listing UTXOs');

var s = JSON.parse(btc('listunspent'));

console.log(`Found ${s.length} UTXO${s.length == 1 ? '' : 's'}`);

s = s
	.filter(u => u.amount >= 500e-8)
	.filter((u, i, l) => l.slice(0, i).filter(x => x.address == u.address).length < 10);

console.log(`Found ${s.length} usable UTXO${s.length == 1 ? '' : 's'}`);

s = s.sort((a, b) => a.amount - b.amount).slice(0, 2000);

if (s.length < 2000) {
	console.log(
		'To fill a block you need\n' +
		' - at least 2000 confirmed UTXOs\n' +
		' - at least 500 sats per UTXO\n' +
		'The same address can only be used in 10 UTXOs'
	);
	process.exit(1);
}

var s4 = Array(10).fill().map(x => []);

[...s].sort((a, b) => {
	if (a.address < b.address) {
		return -1;
	}
	if (a.address > b.address) {
		return 1;
	}
	return 0;
}).forEach((u, i) => {
	s4[i % 10].push(u);
});

s = s4.flat();

var count = 0;

console.log('Sending 50 TXs of 20kvB each');

for (var i = 0; i < 5; i++) {
	var inputs = [];
	var outputs = {};
	var s2 = [];
	var s3 = [];
	var vout = 0;

	s.forEach((u, i) => {
		inputs.push({
			txid: u.txid,
			vout: u.vout
		});

		const amount = parseFloat((u.amount - 0.00000100).toFixed(8));
		if (outputs[u.address]) {
			console.log('Unknown error');
			process.exit(1);
		}
		outputs[u.address] = amount;
		s3.push({
			vout,
			amount,
			address: u.address
		});
		vout++;
		if (vout >= 200) {
			const txid = newtx(inputs, outputs);

			s2.push(...s3.map(x => {
				x.txid = txid;
				return x;
			}));

			inputs = [];
			outputs = {};
			s3 = [];
			vout = 0;

			count++;
			console.log(`Sent transaction txid=${txid} (${count}/50)`);
		}
	});
	s = s2;
}
