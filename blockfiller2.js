const { newtx, listUnspent } = require('./btc');

var count = 0;

main();

async function main() {
	console.log('Listing UTXOs');

	var s = (await listUnspent({ minamount: 110e-8, minconf: 0 }, false))
		.filter(u => u.spendable && u.solvable);

	console.log(`Found ${s.length} usable UTXO${s.length == 1 ? '' : 's'}`);

	if (s.length < 0) {
		console.log('No UTXOs!');
		process.exit(1);
	}

	console.log('Sending TXs of 109.25 vB each');

	const work = [];
	const workers = 4;
	const share = s.length / workers;

	for (var i = 0; i < workers; i++) {
		work.push(s.slice(i * share, workers - 1 == i ? undefined : ((i+1) * share)));
	}

	work.forEach((x, i) => {
		loop(s, i+1);
	});
}

async function loop(s, i) {
	while (s.length) {
		const u = s.shift();
		if (u.amount < 110e-8) {
			continue;
		}
		const amount = parseFloat((u.amount - 110e-8).toFixed(8));
		const out = {};
		const address = u.address;
		out[address] = amount;
		try {
			const txid = await newtx([ u ], out);
			s.push({ txid, vout: 0, address, amount });
			count++;
			console.log(`(${i}) Sent transaction txid=${txid} (#${count})`);
		}
		catch (e) {
		}
	}
}
