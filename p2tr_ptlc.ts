import { strict as assert } from 'assert';
import * as bitcoin from 'bitcoinjs-lib';
import { randomBytes } from 'crypto';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as curve from 'tiny-secp256k1';
import { btc, createTaprootOutput, ecPrivateMul, input, negateIfOddPubkey, send, sleep, tapLeaf } from './btc';

const ECPair = ECPairFactory(curve);

const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_DEFAULT;

function bip340Hash(R: Uint8Array, P: Uint8Array, m: Uint8Array): Uint8Array {
    return bitcoin.crypto.taggedHash('BIP0340/challenge', Buffer.concat([R.slice(-32), P.slice(-32), m]));
}

class Adaptor {
    public s: Uint8Array;
    public R: Uint8Array;
    public T: Uint8Array;

    public constructor(s: Uint8Array, R: Uint8Array, T: Uint8Array) {
        this.s = s;
        this.R = R;
        this.T = T;
    }

    public serialize(): string {
        const b = Buffer.allocUnsafe(98);
        Buffer.from(this.s).copy(b, 0);
        Buffer.from(this.R).copy(b, 32);
        Buffer.from(this.T).copy(b, 65);
        return b.toString('hex');
    }

    public static deserialize(s: string): Adaptor {
        const b = Buffer.from(s, 'hex');
        assert(b.length === 98);
        return new Adaptor(b.subarray(0, 32), b.subarray(32, 65), b.subarray(65));
    }

    public static sign(m: Uint8Array, keypair: ECPairInterface, T: Uint8Array): Adaptor {
        let k = randomBytes(32);
        // R = T + k*G
        let RT = curve.pointAddScalar(T, k);
        while (RT[0] & 1) {
            k = randomBytes(32);
            RT = curve.pointAddScalar(T, k);
        }
        // k + e*d
        return new Adaptor(
            curve.privateAdd(
                k,
                ecPrivateMul(bip340Hash(RT, keypair.publicKey, m), negateIfOddPubkey(keypair.privateKey)),
            ),
            curve.pointFromScalar(k),
            T,
        );
    }

    public verify(m: Buffer, P: Buffer): boolean {
        const RT = curve.pointAdd(this.R, this.T);
        if (RT[0] !== 2) {
            return false;
        }
        const Pclone = Buffer.from(P);
        Pclone[0] = 0x02;
        const eP = curve.pointMultiply(Pclone, bip340Hash(RT, Pclone, m));
        // negate to get -e*P, which we add to s*G to get R' = s*G - e*P
        eP[0] ^= 1;
        const Rp = curve.pointAdd(curve.pointFromScalar(this.s), eP);
        return !Buffer.compare(this.R, Rp);
    }

    public solve(t: Buffer): Buffer {
        if (Buffer.compare(this.T, curve.pointFromScalar(t))) {
            throw new Error('Invalid scalar for adaptor signature');
        }
        return Buffer.concat([curve.pointAdd(this.R, this.T).slice(-32), curve.privateAdd(this.s, t)]);
    }

    public extract(sig: Buffer): Buffer {
        return Buffer.from(curve.privateSub(sig.subarray(32), this.s));
    }
}

const internalKey = Buffer.from(curve.pointFromScalar(bitcoin.crypto.sha256(Buffer.from('unknown key'))));
internalKey[0] = 0x02;

function lockupAddress(
    key1: Buffer,
    key2: Buffer,
): ReturnType<typeof createTaprootOutput> & { leafScript: Buffer; first: boolean } {
    const xonly1 = key1.subarray(-32);
    const xonly2 = key2.subarray(-32);
    const first = xonly1 < xonly2;
    const [k1, k2] = first ? [xonly1, xonly2] : [xonly2, xonly1];
    const leafScript = bitcoin.script.compile([k1, bitcoin.opcodes.OP_CHECKSIGVERIFY, k2, bitcoin.opcodes.OP_CHECKSIG]);
    return { ...createTaprootOutput(internalKey, tapLeaf(leafScript)), leafScript, first };
}

const input_sat = 10000;
const fee_rate = 1;
const tx_size = 153;
/*
const tx_size =
	4 + // ver
	(1 + 1) / 4 + // segwit
	1 + // input count
	  32 + 4 + 1 + 4 + // input 0
	1 + // ouput count
		8 + 1 + (1 + 1 + 32) + // output 0
	(
		1 + // witness stack
			1 + 64 + // witness elem (sig1)
			1 + 64 + // witness elem (sig2)
			1 + (1 + 32 + 1 + 1 + 32 + 1) + // witness elem (tapscript)
			1 + 33 // witness elem (control)
	) / 4
	+ 4 // locktime
*/

const fee_sat = tx_size * fee_rate;
const reltimelock = 144;

if (process.argv[2] == 'bob') {
    bob();
} else {
    alice();
}

async function alice() {
    console.log('User: alice, run "node p2tr_ptlc bob" for the "bob" user');

    const keypair = ECPair.makeRandom({ network });

    console.log('Public key', keypair.publicKey.toString('hex'));

    const otherKey = ECPair.fromPublicKey(Buffer.from(await input("give me bob's public method key: "), 'hex'));

    const lockup = lockupAddress(keypair.publicKey, otherKey.publicKey);
    console.log('Lockup address', lockup.address);

    // create lockup transaction and ask the wallet to fill in inputs and change (fundrawtransaction)
    const ltx = new bitcoin.Transaction();
    ltx.version = 2;
    ltx.addOutput(lockup.scriptPubKey, input_sat);
    console.log(`paste the transaction from

bitcoin-cli -testnet fundrawtransaction ${ltx.toHex()} | jq -r '.hex' | bitcoin-cli -testnet -stdin signrawtransactionwithwallet
`);
    const ltxfhex = await input('here: ');
    const ltxf = bitcoin.Transaction.fromHex(ltxfhex);
    const vout = ltxf.outs.findIndex(x => !x.script.compare(lockup.scriptPubKey));
    console.log('give this output point to bob so he can sign the refund tx', ltxf.getId() + ':' + vout);

    // craft refund tx (sequence=reltimelock, output=alice)
    const txr = new bitcoin.Transaction();
    txr.version = 2;
    txr.addInput(Buffer.from(ltxf.getId(), 'hex').reverse(), vout, reltimelock);
    txr.addOutput(bitcoin.script.compile([bitcoin.opcodes.OP_1, keypair.publicKey.subarray(-32)]), input_sat - fee_sat);
    const sighashr = txr.hashForWitnessV1(0, [lockup.scriptPubKey], [input_sat], hashtype, tapLeaf(lockup.leafScript));
    const refsig = Buffer.from(await input('paste the refund sig: '), 'hex');
    if (otherKey.verifySchnorr(sighashr, refsig)) {
        console.log('valid signature!');
    } else {
        throw new Error('invalid refund signature');
    }
    const myrefsig = keypair.signSchnorr(sighashr);
    const control = Buffer.allocUnsafe(33);
    control[0] = 0xc0 | lockup.parity;
    internalKey.copy(control, 1, 1);
    txr.setWitness(0, [...(lockup.first ? [refsig, myrefsig] : [myrefsig, refsig]), lockup.leafScript, control]);
    console.log('keep the refund tx, it can be sent after ' + reltimelock + ' blocks:', txr.toHex());

    console.log('lockup sent', await send(ltxfhex));

    const T = Buffer.from(await input("give bob's payment point: "), 'hex');

    // craft payout tx (sequence=0xffffffff,output=bob)
    const txp = new bitcoin.Transaction();
    txp.version = 2;
    txp.addInput(Buffer.from(ltxf.getId(), 'hex').reverse(), vout);
    txp.addOutput(
        bitcoin.script.compile([bitcoin.opcodes.OP_1, otherKey.publicKey.subarray(-32)]),
        input_sat - fee_sat,
    );
    const sighashp = txp.hashForWitnessV1(0, [lockup.scriptPubKey], [input_sat], hashtype, tapLeaf(lockup.leafScript));

    const a = Adaptor.sign(sighashp, keypair, T);
    console.log('adaptor signature for bob', a.serialize());
    console.log('checking the chain every 5 seconds to see if bob claimed the funds');
    let bob_spending: string;
    while (true) {
        await sleep(5000);
        try {
            bob_spending = await btc('getrawtransaction', txp.getId());
            console.log('transaction found!');
            break;
        } catch (e) {
            console.log('nothing found yet...');
        }
    }
    const tx = bitcoin.Transaction.fromHex(bob_spending);
    const bob_sig = tx.ins[0].witness[lockup.first ? 1 : 0];
    const t = a.extract(bob_sig);
    console.log("extracted t from bob's signature:", t.toString('hex'));
    if (T.compare(curve.pointFromScalar(t))) {
        throw new Error('t*G != T, evil bob stole my private key');
    } else {
        console.log('t is valid!');
    }
}

async function bob() {
    console.log('User: bob');

    const keypair = ECPair.makeRandom({ network });

    const t = randomBytes(32);
    const T = Buffer.from(curve.pointFromScalar(t));

    console.log('Public key', keypair.publicKey.toString('hex'));

    const otherKey = ECPair.fromPublicKey(Buffer.from(await input("give me alice's public key: "), 'hex'));

    const lockup = lockupAddress(keypair.publicKey, otherKey.publicKey);
    console.log('Lockup address', lockup.address);
    const [txid, vout] = (await input("give me alice's lockup transaction output point: ")).split(':');

    // craft refund tx (sequence=reltimelock, output=alice)
    const txr = new bitcoin.Transaction();
    txr.version = 2;
    txr.addInput(Buffer.from(txid, 'hex').reverse(), parseInt(vout), reltimelock);
    txr.addOutput(
        bitcoin.script.compile([bitcoin.opcodes.OP_1, otherKey.publicKey.subarray(-32)]),
        input_sat - fee_sat,
    );
    const sighashr = txr.hashForWitnessV1(0, [lockup.scriptPubKey], [input_sat], hashtype, tapLeaf(lockup.leafScript));
    console.log('refund signature for alice', keypair.signSchnorr(sighashr).toString('hex'));

    console.log('Adaptor payment point: ', T.toString('hex'));

    // craft payout tx (sequence=0xffffffff,output=bob)
    const txp = new bitcoin.Transaction();
    txp.version = 2;
    txp.addInput(Buffer.from(txid, 'hex').reverse(), parseInt(vout));
    txp.addOutput(bitcoin.script.compile([bitcoin.opcodes.OP_1, keypair.publicKey.subarray(-32)]), input_sat - fee_sat);
    const sighashp = txp.hashForWitnessV1(0, [lockup.scriptPubKey], [input_sat], hashtype, tapLeaf(lockup.leafScript));

    const a = Adaptor.deserialize(await input("give me alice's adaptor signature: "));
    if (T.compare(a.T) || !a.verify(sighashp, otherKey.publicKey)) {
        throw new Error('invalid adaptor sig');
    } else {
        console.log('valid adaptor!');
    }

    const sig1 = keypair.signSchnorr(sighashp);
    const sig2 = a.solve(t);

    const control = Buffer.allocUnsafe(33);
    control[0] = 0xc0 | lockup.parity;
    internalKey.copy(control, 1, 1);
    txp.setWitness(0, [...(lockup.first ? [sig2, sig1] : [sig1, sig2]), lockup.leafScript, control]);

    console.log('payout sent', await send(txp.toHex()));

    console.log('alice should have got the exact same payment secret', t.toString('hex'));
}
