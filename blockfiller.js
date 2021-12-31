const { newtx, listunspent } = require('./btc')();

main();

async function main() {
	console.log('Listing UTXOs');

	var s = (await listunspent(0.000005))
		.filter(u => u.spendable && u.solvable)
		.filter((u, i, l) => l.slice(0, i).filter(x => x.address == u.address).length < 10);

	console.log(`Found ${s.length} usable UTXO${s.length == 1 ? '' : 's'}`);

	if (s.length < 2000) {
		console.log(
			'To fill a block you need\n' +
			' - at least 2000 confirmed UTXOs\n' +
			' - at least 500 sats per UTXO\n' +
			'The same address can only be used in 10 UTXOs'
		);
		process.exit(1);
	}

	s = s.sort((a, b) => a.amount - b.amount).slice(0, 2000);

	const s4 = Array(10).fill().map(x => []);

	[...s].sort((a, b) => {
		if (a.address < b.address) {
			return -1;
		}
		if (a.address > b.address) {
			return 1;
		}
		return 0;
	}).forEach((u, i) => s4[i % 10].push(u));

	s = s4.flat();

	var count = 0;

	console.log('Sending 50 TXs of 20kvB each');

	for (var i = 0; i < 5; i++) {
		var inputs = [];
		var outputs = {};
		var s2 = [];
		var s3 = [];
		var vout = 0;

		for (var j = 0; j < s.length; j++) {
			const u = s[j];
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
				const txid = await newtx(inputs, outputs);

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
		}
		s = s2;
	}
}
