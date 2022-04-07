import * as curve from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { send, bech32toScriptPubKey, fundAddress, getnewaddress, decodeRawTransaction } from './btc';
import { ECPairFactory } from 'ecpair'

const ECPair = ECPairFactory(curve);

const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_DEFAULT;

var ecpair1 = ECPair.makeRandom({ network });
while (ecpair1.publicKey[0] & 1) {
	ecpair1 = ECPair.makeRandom({ network });
}

const ecpair2 = ECPair.makeRandom({ network });

function tapLeaf(script: Buffer) {
	return bitcoin.crypto.taggedHash('TapLeaf', Buffer.concat([ Buffer.from([ 0xc0, script.length ]), script ]));
}

function tapBranch(branch1: Buffer, branch2: Buffer) {
	return bitcoin.crypto.taggedHash('TapBranch', Buffer.concat(branch1 < branch2 ? [ branch1, branch2 ] : [ branch2, branch1 ]));
}

function tapTweak(pubkey: Buffer, branch: Buffer) {
	return bitcoin.crypto.taggedHash('TapTweak', Buffer.concat([ pubkey.slice(-32), branch ]));
}

function createOutput(publicKey: Buffer, tweak: Buffer) {
	const tweaked = curve.pointAddScalar(publicKey, tweak);
	return { parity: tweaked[0] & 1, key: Buffer.from(tweaked).slice(-32) };
}

// build taptree
const leaf1script = bitcoin.script.compile([
	ecpair2.publicKey.slice(1,33),
	bitcoin.opcodes.OP_CHECKSIG,
	ecpair2.publicKey.slice(1,33),
	0xba, // OP_CHECKSIGADD (pending pull: https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742)
	bitcoin.opcodes.OP_2,
	bitcoin.opcodes.OP_EQUAL
]);

const leaf1 = tapLeaf(leaf1script);

const leaf2 = Buffer.alloc(32); // all zeros

const branch = tapBranch(leaf1, leaf2);

const tweak = tapTweak(ecpair1.publicKey, branch);

const tr = createOutput(ecpair1.publicKey, tweak);

const fee_sat = 150;
const input_sat = 1000;

const address = bitcoin.address.toBech32(tr.key, 1, network.bech32);
console.log(address);

fundAddress(address, input_sat).then(async outpoint => {
	const tx = new bitcoin.Transaction();

	tx.version = 2;
	tx.addInput(Buffer.from(outpoint.txid, 'hex').reverse(), outpoint.vout);

	tx.addOutput(bech32toScriptPubKey(await getnewaddress()), input_sat - fee_sat);

	const sighash = tx.hashForWitnessV1(
		0, // which input
		[
			bitcoin.script.compile([
				bitcoin.opcodes.OP_1,
				tr.key
			])
		], // All previous outputs of all inputs
		[ input_sat ], // All previous values of all inputs
		hashtype, // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
		leaf1
	);

	const signature = Buffer.from(curve.signSchnorr(sighash, ecpair2.privateKey));
	const pub = ecpair1.publicKey;
	pub.writeUint8(0xc0 | tr.parity);
	const ctrl = Buffer.concat([ pub, leaf2 ]);
	tx.setWitness(0, [
		signature,
		signature,
		leaf1script,
		ctrl
	]);

	const decoded = await decodeRawTransaction(tx.toHex());
	console.log(JSON.stringify(decoded, null, 2));
	console.log(tx.toHex());

	await send(tx.toHex());
	console.log('sendrawtransaction successful');
});
