import * as curve from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { send, bech32toScriptPubKey } from './btc';
import { ECPairFactory, ECPairInterface } from 'ecpair'

const ECPair = ECPairFactory(curve);

const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_DEFAULT;

// when you f*cked up a script taproot keyspend can save your coins!
const keyspend = false;

const ecpair1 = ECPair.fromPrivateKey(
	bitcoin.crypto.sha256(Buffer.from('<slam head on your keyboard for more randomness>addsadadasdads'))
);
ecpair1.network = network;

const ecpair2 = ECPair.fromPrivateKey(
	bitcoin.crypto.sha256(Buffer.from('<slam head on your keyboard for more randomness>asdasdasdasd'))
);
ecpair2.network = network;

function tapLeaf(script: Buffer) {
	return bitcoin.crypto.taggedHash('TapLeaf', Buffer.concat([ Buffer.from([ 0xc0, script.length ]), script ]));
}

function tapBranch(branch1: Buffer, branch2: Buffer) {
	return bitcoin.crypto.taggedHash('TapBranch', Buffer.concat(branch1 < branch2 ? [ branch1, branch2 ] : [ branch2, branch1 ]));
}

function tapTweak(pubkey: Buffer, branch: Buffer) {
	return bitcoin.crypto.taggedHash('TapTweak', Buffer.concat([ pubkey.slice(-32), branch ]));
}

const script = bitcoin.script.compile([
	ecpair2.publicKey.slice(1,33),
	bitcoin.opcodes.OP_CHECKSIG,
	ecpair2.publicKey.slice(1,33),
	0xba, // OP_CHECKSIGADD (pending pull: https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742)
	bitcoin.opcodes.OP_2,
	bitcoin.opcodes.OP_EQUAL
]);

const leaf = tapLeaf(script);

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

const tweak = tapTweak(ecpair1.publicKey, tapBranch(leaf, Buffer.alloc(32))); // Buffer.alloc(32) zero-allocates 32 bytes (a 0 uint256)

function createOutput(publicKey: Buffer) {
	// x-only pubkey (remove 1 byte y parity)
	const myXOnlyPubkey = publicKey.slice(1, 33);
	const tweakResult = curve.xOnlyPointAddTweak(myXOnlyPubkey, tweak);
	if (tweakResult === null) throw new Error('Invalid Tweak');
	const { xOnlyPubkey: tweaked } = tweakResult;
	// incomplete scriptPubkey
	return Buffer.from(tweaked);
}

function sign(messageHash: Buffer, key: ECPairInterface) {
	const privateKey =
		key.publicKey[0] === 2
			? key.privateKey
			: curve.privateAdd(curve.privateSub(N_LESS_1, key.privateKey), ONE);
	const newPrivateKey = curve.privateAdd(privateKey, tweak);
	if (newPrivateKey === null) throw new Error('Invalid Tweak');
	return Buffer.from(curve.signSchnorr(messageHash, newPrivateKey));
}

const tr = createOutput(ecpair1.publicKey);

console.log(`send 1000 sats to ${bitcoin.address.toBech32(tr, 1, network.bech32)}`);

const tx = new bitcoin.Transaction();

const txid = '1234....'; // txid hex here
const vout = 0;

tx.version = 2;
tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);

const fee_sat = 150;
const input_sat = 10000;

tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), input_sat - fee_sat);

const sighash = tx.hashForWitnessV1(
	0, // which input
	[
		bitcoin.script.compile([
			bitcoin.opcodes.OP_1,
			tr
		])
	], // All previous outputs of all inputs
	[ input_sat ], // All previous values of all inputs
	hashtype, // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
	keyspend ? undefined : leaf
);

if (keyspend) {
	const signature = sign(sighash, ecpair1);
	tx.setWitness(0, [ signature ]);
} else {
	const signature = Buffer.from(curve.signSchnorr(sighash, ecpair2.privateKey));
	const pub = ecpair1.publicKey;
	pub.writeUint8(0xc0 | (pub[0] & 1));
	const ctrl = Buffer.concat([ pub, Buffer.alloc(32) ]);
	tx.setWitness(0, [
		signature,
		signature,
		script,
		ctrl
	]);
}

console.log(tx.toHex());
send(tx.toHex()).then(console.log);
