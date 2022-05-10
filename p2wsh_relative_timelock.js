const { btc, send, bech32toScriptPubKey } = require('./btc');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));

const txid = '1234....'; // txid hex here
const vout = 0;

// address to lock the coins
const addr = 'tb1qbech32addresshere';

// relative timelock in blocks, meaning it is spendable after n confirmations
const tl = 5;

main();

async function main() {
	const key = btc('dumpprivkey', addr);

	const ecpair = ECPair.fromWIF(await key, network);

	var witnessScript;
	if (tl == 1) {
		// trick
		witnessScript = bitcoin.script.compile([
			ecpair.publicKey,
			bitcoin.opcodes.OP_CHECKSIG,
			bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY
		]);
	} else {
		witnessScript = bitcoin.script.compile([
			ecpair.publicKey,
			bitcoin.opcodes.OP_CHECKSIGVERIFY,
			bitcoin.script.number.encode(tl),
			bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY
		]);
	}

	console.log(
		'send 1000 sat to ' +
		bitcoin.payments.p2wsh({ redeem: { output: witnessScript, network }, network }).address
	);

	const tx = new bitcoin.Transaction(network);

	// OP_CHECKSEQUENCEVERIFY doesn't work on version 1
	tx.version = 2;

	tx.addInput(Buffer.from(txid, 'hex').reverse(), vout, tl);

	const amount = 1000;
	const fee = 100;

	tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), amount - fee);

	const sighash = tx.hashForWitnessV0(0, witnessScript, amount, hashtype);
	const witness = bitcoin.payments.p2wsh({
		redeem: {
			input: bitcoin.script.compile([
				bitcoin.script.signature.encode(ecpair.sign(sighash), hashtype)
			]),
			output: witnessScript
		}
	}).witness;

	tx.setWitness(0, witness);

	console.log(await send(tx.toHex()));
}
