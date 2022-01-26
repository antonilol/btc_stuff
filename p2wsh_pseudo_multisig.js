const { btc, send, bech32toScriptPubKey } = require('./btc');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));

const txid = '1234....'; // txid hex here
const vout = 0;

// two addresses for the pseudo 2 of 2 multisig
const addr1 = 'tb1qbech32addresshere';
const addr2 = 'tb1qbech32addresshere';

main();

async function main() {
	const key1 = btc('dumpprivkey', addr1);
	const key2 = btc('dumpprivkey', addr2);

	const ecpair1 = ECPair.fromWIF(await key1, network);
	const ecpair2 = ECPair.fromWIF(await key2, network);

	const witnessScript = bitcoin.script.compile([
		ecpair1.publicKey,
		bitcoin.opcodes.OP_CHECKSIGVERIFY,
		ecpair2.publicKey,
		bitcoin.opcodes.OP_CHECKSIG
	]);

	console.log(
		'send 1000 sat to ' +
		bitcoin.payments.p2wsh({ redeem: { output: witnessScript, network }, network }).address
	);

	const tx = new bitcoin.Transaction(network);

	tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);

	const amount = 1000;
	const fee = 100;

	tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), amount - fee);

	const sighash = tx.hashForWitnessV0(0, witnessScript, amount, hashtype);
	const witness = bitcoin.payments.p2wsh({
		redeem: {
			input: bitcoin.script.compile([
				bitcoin.script.signature.encode(ecpair2.sign(sighash), hashtype),
				bitcoin.script.signature.encode(ecpair1.sign(sighash), hashtype)
			]),
			output: witnessScript
		}
	}).witness;

	tx.setWitness(0, witness);

	console.log(await send(tx.toHex()));
}
