const { btc, send, bech32toScriptPubKey } = require('./btc')();
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));

function opcodeNumber(n) {
	if (n == 0) {
		return 0;
	} else if (n > 0 && n < 17) {
		return 80 + n;
	}
	return bitcoin.script.number.encode(n);
}

const txid = '1234....'; // txid hex here
const vout = 0;

const addrs = [
	'tb1qbech32addresshere'
	// ...
];

// multisig configuration
const m = 3;
const n = addrs.length;

if (m > n) {
	console.error('m > n results in an unsolvable script');
	process.exit(1);
}

main();

async function main() {
	const keys = addrs.map(a => btc('dumpprivkey', a));

	const ecpairs = [];
	for (var i = 0; i < keys.length; i++) {
		ecpairs.push(ECPair.fromWIF(await keys[i], network));
	}

	const witnessScriptPieces = [];

	for (var i = 0; i < ecpairs.length; i++) {
		witnessScriptPieces.push(...[
			ecpairs[i].publicKey,
			bitcoin.opcodes.OP_CHECKSIG
		]);
		if (i) {
			witnessScriptPieces.push(bitcoin.opcodes.OP_ADD);
		}
		if (ecpairs.length - 1 == i) {
			witnessScriptPieces.push(...[
				opcodeNumber(m),
				bitcoin.opcodes.OP_EQUAL
			]);
		} else {
			witnessScriptPieces.push(bitcoin.opcodes.OP_SWAP);
		}
	}

	const witnessScript = bitcoin.script.compile(witnessScriptPieces);

	console.log('witnessScript: ' + witnessScript.toString('hex'));

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
				bitcoin.script.signature.encode(ecpairs[4].sign(sighash), hashtype),
				Buffer.allocUnsafe(0),
				bitcoin.script.signature.encode(ecpairs[2].sign(sighash), hashtype),
				Buffer.allocUnsafe(0),
				bitcoin.script.signature.encode(ecpairs[0].sign(sighash), hashtype)
			]),
			output: witnessScript
		}
	}).witness;

	tx.setWitness(0, witness);

	console.log(await send(tx.toHex()));
}
