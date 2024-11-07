import { strict as assert } from 'assert';
import * as bitcoin from 'bitcoinjs-lib';
import * as crypto from 'crypto';
import { ECPairFactory } from 'ecpair';
import * as curve from 'tiny-secp256k1';
import { ecPrivateDiv, ecPrivateMul, fundOutputScript, getnewaddress, p2pkh, send, setChain } from './btc';

setChain('regtest');

const network = bitcoin.networks.regtest;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = ECPairFactory(curve);

function getKeyIV(key: Buffer): { key: Buffer; iv: Buffer } {
    const hash = crypto.createHash('sha512').update(key).digest();

    return {
        key: hash.subarray(0, 32),
        iv: hash.subarray(32, 48),
    };
}

function encrypt(data: Buffer, key: { key: Buffer; iv: Buffer }): Buffer {
    assert(data.length === 32);

    const cipher = crypto.createCipheriv('aes-256-cbc', key.key, key.iv).setAutoPadding(false);
    const encrypted = cipher.update(data);

    return Buffer.concat([encrypted, cipher.final()]);
}

function decrypt(data: Buffer, key: { key: Buffer; iv: Buffer }): Buffer {
    assert(data.length === 32);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key.key, key.iv).setAutoPadding(false);
    const decrypted = decipher.update(data);

    return Buffer.concat([decrypted, decipher.final()]);
}

function sign(m: Buffer, d: Buffer, data: Buffer): { sig: Buffer; recoveryHint: Buffer } {
    assert(m.length === 32);
    assert(d.length === 32);
    assert(data.length === 32);

    let counter = 0;
    const k1Data = Buffer.concat([Buffer.from('nonce'), d, m, Buffer.alloc(4)]);
    const encData = encrypt(data, getKeyIV(Buffer.concat([Buffer.from('data'), d, m])));

    let k: Uint8Array;
    let R: Uint8Array;

    while (true) {
        k = bitcoin.crypto.sha256(k1Data);
        for (let i = 0; i < 32; i++) {
            k[i] ^= encData[i];
        }
        R = curve.pointFromScalar(k);
        if (R[1] < 0x80) {
            break;
        }
        counter++;
        k1Data.writeUint32LE(counter, 69);
    }

    const r = R.subarray(1);

    // s = (m + r*d) / k
    let s: Uint8Array = ecPrivateDiv(curve.privateAdd(m, ecPrivateMul(r, d)), k);

    const recoveryHint = Buffer.alloc(5);
    recoveryHint.writeUintLE(counter << 1, 0, 5);

    // should actually check if s > -s
    if (s[0] >= 0x80) {
        s = curve.privateNegate(s);
        recoveryHint[0] |= 1;
    }

    const obfuscation = bitcoin.crypto.sha256(Buffer.concat([Buffer.from('recoveryHint'), d, m]));
    for (let i = 0; i < 5; i++) {
        recoveryHint[i] ^= obfuscation[i];
    }

    return { sig: Buffer.concat([r, s]), recoveryHint };
}

function recover(sig: Buffer, m: Buffer, d: Buffer, checkDataFn: undefined, recoveryHint?: Buffer): Buffer;
function recover(
    sig: Buffer,
    m: Buffer,
    d: Buffer,
    checkDataFn: (data: Buffer) => boolean,
    recoveryHint?: Buffer,
): Buffer;
function recover<T>(
    sig: Buffer,
    m: Buffer,
    d: Buffer,
    checkDataFn: (data: Buffer) => { ok: boolean; data: T },
    recoveryHint?: Buffer,
): T;
function recover<T>(
    sig: Buffer,
    m: Buffer,
    d: Buffer,
    checkDataFn?: (data: Buffer) => { ok: boolean; data: T } | boolean,
    recoveryHint?: Buffer,
): T | Buffer;
function recover<T>(
    sig: Buffer,
    m: Buffer,
    d: Buffer,
    checkDataFn?: (data: Buffer) => { ok: boolean; data: T } | boolean,
    recoveryHint?: Buffer,
): T | Buffer {
    assert(sig.length === 64);
    assert(m.length === 32);
    assert(d.length === 32);
    assert(!recoveryHint || recoveryHint.length <= 5);

    const r = sig.subarray(0, 32);
    const s = sig.subarray(32, 64);

    // k = (m + r*d) / s
    const k = ecPrivateDiv(curve.privateAdd(m, ecPrivateMul(r, d)), s);
    const kHighS = curve.privateNegate(k);

    let counter = 0;
    let counterDelta = 1;
    let highS = false;

    if (recoveryHint && recoveryHint.length) {
        const obfuscation = bitcoin.crypto.sha256(Buffer.concat([Buffer.from('recoveryHint'), d, m]));
        const recoveryHintDeobf = Buffer.allocUnsafe(recoveryHint.length);
        for (let i = 0; i < recoveryHint.length; i++) {
            recoveryHintDeobf[i] = recoveryHint[i] ^ obfuscation[i];
        }
        counter = recoveryHintDeobf.readUintLE(0, recoveryHintDeobf.length) >> 1;
        counterDelta = 1 << (recoveryHintDeobf.length * 8 - 1);
        highS = (recoveryHintDeobf[0] & 0x01) === 1;
    }

    const k1Data = Buffer.concat([Buffer.from('nonce'), d, m, Buffer.allocUnsafe(4)]);

    // does not change every time so is calculated outside the loop
    const key = getKeyIV(Buffer.concat([Buffer.from('data'), d, m]));

    while (true) {
        k1Data.writeUint32LE(counter, 69);
        const k1 = bitcoin.crypto.sha256(k1Data);
        const encData = Buffer.from(highS ? kHighS : k);
        for (let i = 0; i < 32; i++) {
            encData[i] ^= k1[i];
        }

        const data = decrypt(encData, key);
        if (!checkDataFn) {
            return data;
        }
        const res = checkDataFn(data);
        if (typeof res === 'boolean') {
            if (res) {
                return data;
            }
        } else if (res.ok) {
            return res.data;
        }

        if (highS) {
            counter += counterDelta;
        }
        highS = !highS;
    }
}

const ecpair = ECPair.makeRandom();
console.log('Private key:', ecpair.privateKey.toString('hex'));
const script = bitcoin.script.compile([bitcoin.opcodes.OP_0, bitcoin.crypto.hash160(ecpair.publicKey)]);

const amount = 10000;
const fee = 122;

fundOutputScript(script, amount).then(async funding => {
    const tx = new bitcoin.Transaction();

    tx.addInput(funding.txidBytes, funding.vout);
    tx.addOutput(bitcoin.address.toOutputScript(await getnewaddress(), network), amount - fee);

    const sighash = tx.hashForWitnessV0(0, p2pkh(ecpair.publicKey), amount, hashtype);

    const data = Buffer.from('p2wpkh_sigdata.ts test          ');

    const sig = sign(sighash, ecpair.privateKey, data);

    // we need to have some way to check the recovered data is correct because the
    // original signature may not have had a low r and / or low s.
    // lets say we know the data always ends on 10 spaces
    assert(
        data.equals(recover(sig.sig, sighash, ecpair.privateKey, data => data.toString().endsWith(' '.repeat(10)))),
        'recovery with checkDataFn failed',
    );

    // the recovery hint encodes the low r counter and low s state, no checkDataFn is needed here
    assert(
        data.equals(recover(sig.sig, sighash, ecpair.privateKey, undefined, sig.recoveryHint)),
        'recovery with full recoveryHint failed',
    );

    // the more bytes of the recovery hint are passed to the function, the higher the
    // chance it will get the right data right away
    // the first byte of the recovery hint is the most important, the right data
    // will almost always be found
    assert(
        data.equals(recover(sig.sig, sighash, ecpair.privateKey, undefined, sig.recoveryHint.subarray(0, 1))),
        'recovery with 1 byte recoveryHint failed',
    );

    tx.setWitness(0, [bitcoin.script.signature.encode(sig.sig, hashtype), ecpair.publicKey]);

    console.log(tx.toHex());
    await send(tx.toHex());
});
