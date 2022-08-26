const { newtx, listUnspent, getnewaddress } = require('./btc');
const fs = require('fs');

const amount = 2000;

main();

async function main() {
	console.log('Listing UTXOs');

	const s = (await listUnspent({ minamount: 100000, minconf: 0 }))
		.filter(u => u.spendable && u.solvable);

	const i = parseInt(process.argv[2]);

	if (!isNaN(i) && i >= 0 && i < s.length - 1) {
		s.push(s.splice(i, 1));
	}

	console.log(`Found ${s.length} usable UTXO${s.length == 1 ? '' : 's'}`);

	if (s.length < 1) {
		console.log('No UTXOs!');
		process.exit(1);
	}

	var inputs = [];
	var outputs = {};

	var v = 0;

	const change = await getnewaddress();

	var addr = [];
	try {
		addr = JSON.parse(fs.readFileSync('addr.json'));
	}
	catch (e) {
	}

	if (addr.length < 2000) {
		console.log(`Getting ${2000 - addr.length} new addresses...`);
	}

	var c = false;

	while (addr.length < 2000) {
		addr.push(await getnewaddress());
		c = true;
	}

	if (c) {
		try {
			fs.writeFileSync('addr.json', JSON.stringify(addr));
		}
		catch (e) {
		}
	}

	addr.forEach(a => {
		v -= amount + 33;
		while (v < 0) {
			if (s.length < 1) {
				throw new Error('insufficient balance!');
			}
			const u = s.pop();
			inputs.push({
				txid: u.txid,
				vout: u.vout
			});
			v += u.amount - 67;
		}
		outputs[a] = amount;
	});

	outputs[change] = v;

	console.log(await newtx(inputs, outputs, true));
}
