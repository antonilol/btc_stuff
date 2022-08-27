const { btc, send, bech32toScriptPubKey } = require('./btc');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));
const crypto = require('crypto');

const txid = '1234....'; // txid hex here
const vout = 0;

// priv key is dumped from this address
const addr = 'tb1qbech32addresshere';

main();

var _tx;

async function main() {
	const key = btc('dumpprivkey', addr);

	const ecpair = ECPair.fromWIF(await key, network);

	const redeemScript = bitcoin.script.compile([
		bitcoin.opcodes.OP_DROP,
		ecpair.publicKey,
		bitcoin.opcodes.OP_CHECKSIG
	]);

	console.log(
		'send 1000 sat to ' +
		bitcoin.payments.p2sh({ redeem: { output: redeemScript, network }, network }).address
	);

	const tx = new bitcoin.Transaction(network);

	tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);

	const amount = 1000;
	const fee = 100;

	tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), amount - fee);

	const sighash = tx.hashForSignature(0, redeemScript, hashtype);
	const sig = bitcoin.script.signature.encode(ecpair.sign(sighash), hashtype);

	tx.setInputScript(0, bitcoin.script.compile([
		sig,
		crypto.randomFillSync(Buffer.alloc(5), 0, 1),
		redeemScript
	]));

	const buf = tx.toBuffer();
	const off = 45 + sig.length; // nonce offset
	const target = 0; // 2 ** 32 allows all hashes, 0 gives the hash 8 zeros (looks like a difficulty 1 block)

	for (var i = 0; i < 2 ** 32; i++) {
		buf.writeUint32BE(i, off);
		const h = bitcoin.crypto.hash256(buf);
		if (h.readUint32LE(28) <= target) {
			console.log(await send(buf.toString('hex')));
			break;
		}
	}
}
