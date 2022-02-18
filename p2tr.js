const { send, bech32toScriptPubKey } = require('./btc');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_DEFAULT;
const curve = require('tiny-secp256k1');
const ECPair = require('ecpair').ECPairFactory(curve);
const crypto = require('crypto');

// really bad private key, only use for testing
const ecpair = ECPair.fromPrivateKey(
	bitcoin.crypto.sha256(Buffer.from('bitcoin'))
);
ecpair.network = network;

const tweak = true;

// inspired by https://github.com/bitcoinjs/bitcoinjs-lib/blob/424abf2376772bb57b7668bc35b29ed18879fa0a/test/integration/taproot.md

// Order of the curve (N) - 1
const N_LESS_1 = Buffer.from(
	'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
	'hex'
);
// 1 represented as 32 bytes BE
const ONE = Buffer.from(
	'0000000000000000000000000000000000000000000000000000000000000001',
	'hex'
);

// Function for creating a tweaked p2tr key-spend only address
// (This is recommended by BIP341)
function createKeySpendOutput(publicKey) {
	// x-only pubkey (remove 1 byte y parity)
	const myXOnlyPubkey = publicKey.slice(1, 33);
	if (tweak) {
		const commitHash = bitcoin.crypto.taggedHash('TapTweak', myXOnlyPubkey);
		const tweakResult = curve.xOnlyPointAddTweak(myXOnlyPubkey, commitHash);
		if (tweakResult === null) throw new Error('Invalid Tweak');
		const { xOnlyPubkey: tweaked } = tweakResult;
		// incomplete scriptPubkey
		return tweaked;
	}
	return myXOnlyPubkey;
}

// Function for signing for a tweaked p2tr key-spend only address
// (Required for the above address)
function sign(messageHash, key) {
	const privateKey =
		key.publicKey[0] === 2
			? key.privateKey
			: curve.privateAdd(curve.privateSub(N_LESS_1, key.privateKey), ONE);
	if (tweak) {
		const tweakHash = bitcoin.crypto.taggedHash(
			'TapTweak',
			key.publicKey.slice(1, 33)
		);
		const newPrivateKey = curve.privateAdd(privateKey, tweakHash);
		if (newPrivateKey === null) throw new Error('Invalid Tweak');
		return curve.signSchnorr(messageHash, newPrivateKey);
	}
	return curve.signSchnorr(messageHash, privateKey);
}

const tr = createKeySpendOutput(ecpair.publicKey);

console.log(`send 1000 sats to ${bitcoin.address.toBech32(tr, 1, network.bech32)}`);

const tx = new bitcoin.Transaction(network);

const txid = '1234....'; // txid hex here
const vout = 0;

tx.version = 2;
tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);

const fee_sat = 100;
const input_sat = 1000;

tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), input_sat-fee_sat);

const sighash = tx.hashForWitnessV1(
	0, // which input
	[ Buffer.concat([ Buffer.from('5120', 'hex'), tr ]) ], // All previous outputs of all inputs
	[ input_sat ], // All previous values of all inputs
	hashtype // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
);
const signature = Buffer.from(sign(sighash, ecpair));
tx.setWitness(0, [ signature ]);

send(tx.toHex()).then(console.log);
