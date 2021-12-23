const { newtx, listunspent, getnewaddress } = require('./btc');
const fs = require('fs');

console.log('Listing UTXOs');

const s = listunspent(0.001, 0)
	.filter(u => u.spendable && u.solvable)
	.map(u => {
		u.amount = Math.round(u.amount * 1e8); // prevent floats
		return u;
	})
	.sort((a, b) => Math.random() < 0.5 ? -1 : 1);

console.log(`Found ${s.length} usable UTXO${s.length == 1 ? '' : 's'}`);

if (s.length < 1) {
	console.log('No UTXOs!');
	process.exit(1);
}

var inputs = [];
var outputs = {};

var v = 0;

const change = getnewaddress();

var addr = [];
try {
	addr = JSON.parse(fs.readFileSync('addr.json'));
}
catch (e) {
}

var c = false;

while (addr.length < 2000) {
	addr.push(getnewaddress());
	c = true;
}

if (c) {
	try {
		fs.writeFileSync('addr.json', JSON.strinify(addr));
	}
	catch (e) {
	}
}

addr.forEach(a => {
	v -= 533;
	while (v < 0) {
		if (s.length < 1) {
			throw new Error('insufficient confirmed balance!');
		}
		const u = s.pop();
		inputs.push({
			txid: u.txid,
			vout: u.vout
		});
		v += u.amount - 33;
	}
	outputs[a] = 500;
});

outputs[change] = v;

console.log(newtx(inputs, outputs, true));
