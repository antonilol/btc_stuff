const { btc, send, bech32toScriptPubKey } = require('./btc');
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
	'tb1qbech32addresshere',
	// ...
];

// the address of the key that can always unlock the funds
const master = 'tb1qbech32addresshere';

// multisig configuration
const m = 3;
const n = addrs.length;

if (m > n) {
	// master key can always unlock so no error
	//console.error('m > n results in an unsolvable script');
	//process.exit(1);
}

main();

async function main() {
	const keys = addrs.map(a => btc('dumpprivkey', a));
	const masterKey = ECPair.fromWIF(await btc('dumpprivkey', master), network);

	const ecpairs = [];
	for (var i = 0; i < keys.length; i++) {
		ecpairs.push(ECPair.fromWIF(await keys[i], network));
	}

	const witnessScript = bitcoin.script.compile([
		bitcoin.opcodes.OP_IF,
			opcodeNumber(m),
			...ecpairs.map(x => x.publicKey),
			opcodeNumber(n),
			bitcoin.opcodes.OP_CHECKMULTISIG,
		bitcoin.opcodes.OP_ELSE,
			masterKey.publicKey,
			bitcoin.opcodes.OP_CHECKSIG,
		bitcoin.opcodes.OP_ENDIF
	]);

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
				// master key
				// bitcoin.script.signature.encode(masterKey.sign(sighash), hashtype),
				// bitcoin.script.number.encode(0)
				
				// multisig 3 of 4
				bitcoin.script.number.encode(0),
				...ecpairs.slice(1).map(x => bitcoin.script.signature.encode(x.sign(sighash), hashtype)),
				bitcoin.script.number.encode(1)
			]),
			output: witnessScript
		}
	}).witness;

	tx.setWitness(0, witness);

	console.log(await send(tx.toHex()));
}
