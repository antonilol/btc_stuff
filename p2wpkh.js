const { btc, send, listUnspent, getnewaddress, bech32toScriptPubKey, input } = require('./btc');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));

main();

async function main() {
	const u = (await listUnspent({ minconf: 0 })).filter(x => x.solvable && x.spendable && x.desc.startsWith('wpkh'));

	console.log(u);

	const v = await input('Which input to use? ');

	const utxo = u[parseInt(v)];

	if (!utxo) {
		console.log('error');
		process.exit(1);
	}

	var out = await input('Output address (leave empty to generate a new one) ');

	if (out.length == 0) {
		out = await getnewaddress();
	}

	if (out.length != 42) {
		console.log('p2wpkh addresses are 42 chars long');
		process.exit(1);
	}

	const ecpair = ECPair.fromWIF(await btc('dumpprivkey', utxo.address), network);

	const tx = new bitcoin.Transaction(network);

	tx.addInput(Buffer.from(utxo.txid, 'hex').reverse(), utxo.vout);

	const fee = 110;

	tx.addOutput(bech32toScriptPubKey(out), utxo.amount - fee);

	const pkh = bitcoin.script.decompile(Buffer.from(utxo.scriptPubKey, 'hex'))[1];

	const sighash = tx.hashForWitnessV0(
		0, bitcoin.script.compile([
			bitcoin.opcodes.OP_DUP,
			bitcoin.opcodes.OP_HASH160,
			pkh,
			bitcoin.opcodes.OP_EQUALVERIFY,
			bitcoin.opcodes.OP_CHECKSIG
		]), utxo.amount, hashtype
	);

	tx.setWitness(0, [
		bitcoin.script.signature.encode(ecpair.sign(sighash), hashtype),
		ecpair.publicKey
	]);

	console.log(await send(tx.toHex()));
	process.exit(0);
}
