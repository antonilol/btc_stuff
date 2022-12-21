import * as curve from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { send, setChain, getnewaddress, fundOutputScript, p2pkh } from './btc';
import { randomBytes } from 'crypto';
import bs58check from 'bs58check';
import { strict as assert } from 'assert';
import { ECPairFactory } from 'ecpair';

setChain('regtest');

const network = bitcoin.networks.regtest;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = ECPairFactory(curve);

export class StealthAddress {
	readonly spendPriv?: Buffer;
	readonly viewPriv?: Buffer;
	readonly spendPub: Buffer;
	readonly viewPub: Buffer;

	constructor(spendPrivKey: Buffer);
	constructor(spendPubKey: Buffer, viewKey: Buffer);
	constructor(spendKey: Buffer, viewKey?: Buffer) {
		if (spendKey.length == 32) {
			this.spendPriv = spendKey;
		} else if (spendKey.length == 33) {
			if (viewKey.length == 32) {
				this.viewPriv = viewKey;
			} else if (viewKey.length == 33) {
				this.viewPub = viewKey;
			} else {
				throw new Error('Invalid viewKey length');
			}
			this.spendPub = spendKey;
		} else {
			throw new Error('Invalid spendKey length');
		}

		if (this.spendPriv) {
			this.viewPriv = bitcoin.crypto.sha256(this.spendPriv);
			this.spendPub = Buffer.from(curve.pointFromScalar(this.spendPriv));
		}
		if (this.viewPriv) {
			this.viewPub = Buffer.from(curve.pointFromScalar(this.viewPriv));
		}
	}

	/** When sending from a taproot address, add '02' in front of the senderKey */
	deriveOneTimeKey(
		senderKey: Buffer,
		prevTxid: Buffer,
		prevVout: number,
		vout: number
	): { privateKey?: Buffer; publicKey: Buffer } {
		// 33 bytes ecdh shared secret, 32 bytes uint256le prevTxid, 4 bytes uint32le prevVout, 4 bytes uint32le vout
		const secret = Buffer.allocUnsafe(73);

		if (senderKey.length == 32) {
			Buffer.from(curve.pointMultiply(this.viewPub, senderKey)).copy(secret);
		} else if (senderKey.length == 33) {
			if (!this.viewPriv) {
				throw new Error('Private view key is needed');
			}
			Buffer.from(curve.pointMultiply(senderKey, this.viewPriv)).copy(secret);
		} else {
			throw new Error('Invalid senderKey length');
		}

		prevTxid.copy(secret, 33);
		secret.writeUint32LE(prevVout, 65);
		secret.writeUint32LE(vout, 69);

		const tweak = bitcoin.crypto.sha256(secret);
		if (this.spendPriv) {
			const privateKey = curve.privateAdd(this.spendPriv, tweak);
			return { privateKey: Buffer.from(privateKey), publicKey: Buffer.from(curve.pointFromScalar(privateKey)) };
		} else {
			return { publicKey: Buffer.from(curve.pointAddScalar(this.spendPub, tweak)) };
		}
	}

	static checkOneTimeKey(script: Buffer, publicKey: Buffer): 'p2wpkh' | 'p2tr' | undefined {
		if (script.equals(bitcoin.script.compile([ bitcoin.opcodes.OP_1, publicKey.slice(1) ]))) {
			return 'p2tr';
		} else if (script.equals(bitcoin.script.compile([ bitcoin.opcodes.OP_0, bitcoin.crypto.hash160(publicKey) ]))) {
			return 'p2wpkh';
		}
	}

	deriveOneTimeKeys(
		senderKey: Buffer,
		tx: bitcoin.Transaction
	): ({ privateKey?: Buffer; publicKey: Buffer; type: 'p2wpkh' | 'p2tr' } | undefined)[] {
		const output = [];

		for (let i = 0; i < tx.outs.length; i++) {
			const k = this.deriveOneTimeKey(senderKey, tx.ins[0].hash, tx.ins[0].index, i);
			const type = StealthAddress.checkOneTimeKey(tx.outs[i].script, k.publicKey);
			output.push(type ? { ...k, type } : undefined);
		}

		return output;
	}

	equals(other: StealthAddress) {
		return this.spendPub.equals(other.spendPub) && this.viewPub.equals(other.viewPub);
	}

	strictEquals(other: StealthAddress) {
		return this.equals(other) && !this.spendPriv == !other.spendPriv && !this.viewPriv == !other.viewPriv;
	}

	toString(): string {
		// subject to change
		if (this.spendPriv) {
			return bs58check.encode(Buffer.concat([ Buffer.from([ 0x35, 0x05, 0x39 ]), this.spendPriv ]));
		} else if (this.viewPriv) {
			const parity = this.spendPub[0] & 1;
			return bs58check.encode(
				Buffer.concat([ Buffer.from([ 0x28, 0x70, 0x42, 0xb0 | parity ]), this.spendPub.slice(1), this.viewPriv ])
			);
		} else {
			const parity = ((this.spendPub[0] & 1) << 1) | (this.viewPub[0] & 1);
			return bs58check.encode(
				Buffer.concat([ Buffer.from([ 0x28, 0x6f, 0xba, 0x94 | parity ]), this.spendPub.slice(1), this.viewPub.slice(1) ])
			);
		}
	}

	static fromString(s: string) {
		// subject to change
		const data = bs58check.decode(s);
		if (data.length == 35 && data[0] == 0x35 && data[1] == 0x05 && data[2] == 0x39) {
			return new StealthAddress(data.subarray(3, 35));
		} else if (data.length == 68 && data[0] == 0x28 && data[1] == 0x70 && data[2] == 0x42 && (data[3] & 0xfe) == 0xb0) {
			const spendPub = Buffer.concat([ Buffer.from([ data[3] & 1 ? 0x03 : 0x02 ]), data.subarray(4, 36) ]);
			return new StealthAddress(spendPub, data.subarray(36, 68));
		} else if (data.length == 68 && data[0] == 0x28 && data[1] == 0x6f && data[2] == 0xba && (data[3] & 0xfc) == 0x94) {
			const spendPub = Buffer.concat([ Buffer.from([ data[3] & 2 ? 0x03 : 0x02 ]), data.subarray(4, 36) ]);
			const viewPub = Buffer.concat([ Buffer.from([ data[3] & 1 ? 0x03 : 0x02 ]), data.subarray(36, 68) ]);
			return new StealthAddress(spendPub, viewPub);
		} else {
			throw new Error('Invalid encoding');
		}
	}
}

// generate a random address and test toString, fromString and derived addresses
const priv = new StealthAddress(randomBytes(32));
assert(priv.strictEquals(StealthAddress.fromString(priv.toString())));

const watchonly = new StealthAddress(priv.spendPub, priv.viewPriv);
assert(watchonly.strictEquals(StealthAddress.fromString(watchonly.toString())));
assert(watchonly.equals(priv));

const pub = new StealthAddress(priv.spendPub, priv.viewPub);
const pub2 = new StealthAddress(watchonly.spendPub, watchonly.viewPub);
assert(pub.strictEquals(StealthAddress.fromString(pub.toString())));
assert(pub2.strictEquals(StealthAddress.fromString(pub2.toString())));
assert(pub.equals(priv));
assert(pub2.equals(priv));

// test paying to the address, visibility with the view key and spending with the spend key
const amount1 = 10000;
const fee1 = 110;
const amount2 = amount1 - fee1;
const fee2 = 122;

const ecpair = ECPair.makeRandom({ network });
const p2wpkh = bitcoin.script.compile([ 0, bitcoin.crypto.hash160(ecpair.publicKey) ]);
fundOutputScript(p2wpkh, amount1).then(async funding => {
	console.log('funding', funding.hex);

	// send to `pub`
	const tx1 = new bitcoin.Transaction();

	tx1.addInput(funding.txidBytes, funding.vout);

	const oneTimeKey = pub.deriveOneTimeKey(ecpair.privateKey, funding.txidBytes, funding.vout, 0).publicKey;
	tx1.addOutput(bitcoin.script.compile([ 0, bitcoin.crypto.hash160(oneTimeKey) ]), amount1 - fee1);

	const sighash1 = tx1.hashForWitnessV0(0, p2pkh(ecpair.publicKey), amount1, hashtype);

	tx1.setWitness(0, [ bitcoin.script.signature.encode(ecpair.sign(sighash1), hashtype), ecpair.publicKey ]);

	console.log('pay to one time address', tx1.toHex());
	await send(tx1.toHex());

	// check public key with `watchonly`
	const oneTimePubs = watchonly.deriveOneTimeKeys(ecpair.publicKey, tx1);
	assert(oneTimePubs.length === 1 && oneTimePubs[0].type === 'p2wpkh' && oneTimePubs[0].publicKey.equals(oneTimeKey));

	// check spending with `priv`
	const oneTimePrivs = priv.deriveOneTimeKeys(ecpair.publicKey, tx1);
	assert(
		oneTimePrivs.length === 1 && oneTimePrivs[0].type === 'p2wpkh' && oneTimePrivs[0].publicKey.equals(oneTimeKey)
	);

	const tx2 = new bitcoin.Transaction();

	tx2.addInput(Buffer.from(tx1.getId(), 'hex').reverse(), 0);

	tx2.addOutput(bitcoin.address.toOutputScript(await getnewaddress(), network), amount2 - fee2);

	const sighash2 = tx2.hashForWitnessV0(0, p2pkh(oneTimePrivs[0].publicKey), amount2, hashtype);

	tx2.setWitness(0, [
		bitcoin.script.signature.encode(ECPair.fromPrivateKey(oneTimePrivs[0].privateKey).sign(sighash2), hashtype),
		oneTimePrivs[0].publicKey
	]);

	console.log('spend from one time address', tx2.toHex());
	await send(tx2.toHex());
});
