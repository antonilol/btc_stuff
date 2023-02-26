"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const btc_1 = require("./btc");
const curve = __importStar(require("tiny-secp256k1"));
const ecpair_1 = require("ecpair");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const crypto = __importStar(require("crypto"));
const assert_1 = require("assert");
(0, btc_1.setChain)('regtest');
const network = bitcoin.networks.regtest;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
function getKeyIV(key) {
    const hash = crypto.createHash('sha512').update(key).digest();
    return {
        key: hash.subarray(0, 32),
        iv: hash.subarray(32, 48)
    };
}
function encrypt(data, key) {
    (0, assert_1.strict)(data.length === 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key.key, key.iv).setAutoPadding(false);
    const encrypted = cipher.update(data);
    return Buffer.concat([encrypted, cipher.final()]);
}
function decrypt(data, key) {
    (0, assert_1.strict)(data.length === 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key.key, key.iv).setAutoPadding(false);
    const decrypted = decipher.update(data);
    return Buffer.concat([decrypted, decipher.final()]);
}
function sign(m, d, data) {
    (0, assert_1.strict)(m.length === 32);
    (0, assert_1.strict)(d.length === 32);
    (0, assert_1.strict)(data.length === 32);
    let counter = 0;
    const k1Data = Buffer.concat([Buffer.from('nonce'), d, m, Buffer.alloc(4)]);
    const encData = encrypt(data, getKeyIV(Buffer.concat([Buffer.from('data'), d, m])));
    let k;
    let R;
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
    let s = (0, btc_1.ecPrivateDiv)(curve.privateAdd(m, (0, btc_1.ecPrivateMul)(r, d)), k);
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
function recover(sig, m, d, checkDataFn, recoveryHint) {
    (0, assert_1.strict)(sig.length === 64);
    (0, assert_1.strict)(m.length === 32);
    (0, assert_1.strict)(d.length === 32);
    (0, assert_1.strict)(!recoveryHint || recoveryHint.length <= 5);
    const r = sig.subarray(0, 32);
    const s = sig.subarray(32, 64);
    // k = (m + r*d) / s
    const k = (0, btc_1.ecPrivateDiv)(curve.privateAdd(m, (0, btc_1.ecPrivateMul)(r, d)), s);
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
        }
        else if (res.ok) {
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
(0, btc_1.fundOutputScript)(script, amount).then(async (funding) => {
    const tx = new bitcoin.Transaction();
    tx.addInput(funding.txidBytes, funding.vout);
    tx.addOutput(bitcoin.address.toOutputScript(await (0, btc_1.getnewaddress)(), network), amount - fee);
    const sighash = tx.hashForWitnessV0(0, (0, btc_1.p2pkh)(ecpair.publicKey), amount, hashtype);
    const data = Buffer.from('p2wpkh_sigdata.ts test          ');
    const sig = sign(sighash, ecpair.privateKey, data);
    // we need to have some way to check the recovered data is correct because the
    // original signature may not have had a low r and / or low s.
    // lets say we know the data always ends on 10 spaces
    (0, assert_1.strict)(data.equals(recover(sig.sig, sighash, ecpair.privateKey, data => data.toString().endsWith(' '.repeat(10)))), 'recovery with checkDataFn failed');
    // the recovery hint encodes the low r counter and low s state, no checkDataFn is needed here
    (0, assert_1.strict)(data.equals(recover(sig.sig, sighash, ecpair.privateKey, undefined, sig.recoveryHint)), 'recovery with full recoveryHint failed');
    // the more bytes of the recovery hint are passed to the function, the higher the
    // chance it will get the right data right away
    // the first byte of the recovery hint is the most important, the right data
    // will almost always be found
    (0, assert_1.strict)(data.equals(recover(sig.sig, sighash, ecpair.privateKey, undefined, sig.recoveryHint.subarray(0, 1))), 'recovery with 1 byte recoveryHint failed');
    tx.setWitness(0, [bitcoin.script.signature.encode(sig.sig, hashtype), ecpair.publicKey]);
    console.log(tx.toHex());
    await (0, btc_1.send)(tx.toHex());
});
