"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StealthAddress = void 0;
const curve = __importStar(require("tiny-secp256k1"));
const bitcoin = __importStar(require("bitcoinjs-lib"));
const btc_1 = require("./btc");
const crypto_1 = require("crypto");
const bs58check_1 = __importDefault(require("bs58check"));
const assert_1 = require("assert");
const ecpair_1 = require("ecpair");
(0, btc_1.setChain)('regtest');
const network = bitcoin.networks.regtest;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
class StealthAddress {
    constructor(spendKey, viewKey) {
        if (spendKey.length == 32) {
            this.spendPriv = spendKey;
        }
        else if (spendKey.length == 33) {
            if (viewKey.length == 32) {
                this.viewPriv = viewKey;
            }
            else if (viewKey.length == 33) {
                this.viewPub = viewKey;
            }
            else {
                throw new Error('Invalid viewKey length');
            }
            this.spendPub = spendKey;
        }
        else {
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
    deriveOneTimeKey(senderKey, prevTxid, prevVout, vout) {
        // 33 bytes ecdh shared secret, 32 bytes uint256le prevTxid, 4 bytes uint32le prevVout, 4 bytes uint32le vout
        const secret = Buffer.allocUnsafe(73);
        if (senderKey.length == 32) {
            Buffer.from(curve.pointMultiply(this.viewPub, senderKey)).copy(secret);
        }
        else if (senderKey.length == 33) {
            if (!this.viewPriv) {
                throw new Error('Private view key is needed');
            }
            Buffer.from(curve.pointMultiply(senderKey, this.viewPriv)).copy(secret);
        }
        else {
            throw new Error('Invalid senderKey length');
        }
        prevTxid.copy(secret, 33);
        secret.writeUint32LE(prevVout, 65);
        secret.writeUint32LE(vout, 69);
        const tweak = bitcoin.crypto.sha256(secret);
        if (this.spendPriv) {
            const privateKey = curve.privateAdd(this.spendPriv, tweak);
            return { privateKey: Buffer.from(privateKey), publicKey: Buffer.from(curve.pointFromScalar(privateKey)) };
        }
        else {
            return { publicKey: Buffer.from(curve.pointAddScalar(this.spendPub, tweak)) };
        }
    }
    static checkOneTimeKey(script, publicKey) {
        if (script.equals(bitcoin.script.compile([bitcoin.opcodes.OP_1, publicKey.slice(1)]))) {
            return 'p2tr';
        }
        else if (script.equals(bitcoin.script.compile([bitcoin.opcodes.OP_0, bitcoin.crypto.hash160(publicKey)]))) {
            return 'p2wpkh';
        }
    }
    deriveOneTimeKeys(senderKey, tx) {
        const output = [];
        for (let i = 0; i < tx.outs.length; i++) {
            const k = this.deriveOneTimeKey(senderKey, tx.ins[0].hash, tx.ins[0].index, i);
            const type = StealthAddress.checkOneTimeKey(tx.outs[i].script, k.publicKey);
            output.push(type ? { ...k, type } : undefined);
        }
        return output;
    }
    equals(other) {
        return this.spendPub.equals(other.spendPub) && this.viewPub.equals(other.viewPub);
    }
    strictEquals(other) {
        return this.equals(other) && !this.spendPriv == !other.spendPriv && !this.viewPriv == !other.viewPriv;
    }
    toString() {
        // subject to change
        if (this.spendPriv) {
            return bs58check_1.default.encode(Buffer.concat([Buffer.from([0x35, 0x05, 0x39]), this.spendPriv]));
        }
        else if (this.viewPriv) {
            const parity = this.spendPub[0] & 1;
            return bs58check_1.default.encode(Buffer.concat([Buffer.from([0x28, 0x70, 0x42, 0xb0 | parity]), this.spendPub.slice(1), this.viewPriv]));
        }
        else {
            const parity = ((this.spendPub[0] & 1) << 1) | (this.viewPub[0] & 1);
            return bs58check_1.default.encode(Buffer.concat([Buffer.from([0x28, 0x6f, 0xba, 0x94 | parity]), this.spendPub.slice(1), this.viewPub.slice(1)]));
        }
    }
    static fromString(s) {
        // subject to change
        const data = bs58check_1.default.decode(s);
        if (data.length == 35 && data[0] == 0x35 && data[1] == 0x05 && data[2] == 0x39) {
            return new StealthAddress(data.subarray(3, 35));
        }
        else if (data.length == 68 && data[0] == 0x28 && data[1] == 0x70 && data[2] == 0x42 && (data[3] & 0xfe) == 0xb0) {
            const spendPub = Buffer.concat([Buffer.from([data[3] & 1 ? 0x03 : 0x02]), data.subarray(4, 36)]);
            return new StealthAddress(spendPub, data.subarray(36, 68));
        }
        else if (data.length == 68 && data[0] == 0x28 && data[1] == 0x6f && data[2] == 0xba && (data[3] & 0xfc) == 0x94) {
            const spendPub = Buffer.concat([Buffer.from([data[3] & 2 ? 0x03 : 0x02]), data.subarray(4, 36)]);
            const viewPub = Buffer.concat([Buffer.from([data[3] & 1 ? 0x03 : 0x02]), data.subarray(36, 68)]);
            return new StealthAddress(spendPub, viewPub);
        }
        else {
            throw new Error('Invalid encoding');
        }
    }
}
exports.StealthAddress = StealthAddress;
// generate a random address and test toString, fromString and derived addresses
const priv = new StealthAddress((0, crypto_1.randomBytes)(32));
(0, assert_1.strict)(priv.strictEquals(StealthAddress.fromString(priv.toString())));
const watchonly = new StealthAddress(priv.spendPub, priv.viewPriv);
(0, assert_1.strict)(watchonly.strictEquals(StealthAddress.fromString(watchonly.toString())));
(0, assert_1.strict)(watchonly.equals(priv));
const pub = new StealthAddress(priv.spendPub, priv.viewPub);
const pub2 = new StealthAddress(watchonly.spendPub, watchonly.viewPub);
(0, assert_1.strict)(pub.strictEquals(StealthAddress.fromString(pub.toString())));
(0, assert_1.strict)(pub2.strictEquals(StealthAddress.fromString(pub2.toString())));
(0, assert_1.strict)(pub.equals(priv));
(0, assert_1.strict)(pub2.equals(priv));
// test paying to the address, visibility with the view key and spending with the spend key
const amount1 = 10000;
const fee1 = 110;
const amount2 = amount1 - fee1;
const fee2 = 122;
const ecpair = ECPair.makeRandom({ network });
const p2wpkh = bitcoin.script.compile([0, bitcoin.crypto.hash160(ecpair.publicKey)]);
(0, btc_1.fundOutputScript)(p2wpkh, amount1).then(async (funding) => {
    console.log('funding', funding.hex);
    // send to `pub`
    const tx1 = new bitcoin.Transaction();
    tx1.addInput(funding.txidBytes, funding.vout);
    const oneTimeKey = pub.deriveOneTimeKey(ecpair.privateKey, funding.txidBytes, funding.vout, 0).publicKey;
    tx1.addOutput(bitcoin.script.compile([0, bitcoin.crypto.hash160(oneTimeKey)]), amount1 - fee1);
    const sighash1 = tx1.hashForWitnessV0(0, (0, btc_1.p2pkh)(ecpair.publicKey), amount1, hashtype);
    tx1.setWitness(0, [bitcoin.script.signature.encode(ecpair.sign(sighash1), hashtype), ecpair.publicKey]);
    console.log('pay to one time address', tx1.toHex());
    await (0, btc_1.send)(tx1.toHex());
    // check public key with `watchonly`
    const oneTimePubs = watchonly.deriveOneTimeKeys(ecpair.publicKey, tx1);
    (0, assert_1.strict)(oneTimePubs.length === 1 && oneTimePubs[0].type === 'p2wpkh' && oneTimePubs[0].publicKey.equals(oneTimeKey));
    // check spending with `priv`
    const oneTimePrivs = priv.deriveOneTimeKeys(ecpair.publicKey, tx1);
    (0, assert_1.strict)(oneTimePrivs.length === 1 && oneTimePrivs[0].type === 'p2wpkh' && oneTimePrivs[0].publicKey.equals(oneTimeKey));
    const tx2 = new bitcoin.Transaction();
    tx2.addInput(Buffer.from(tx1.getId(), 'hex').reverse(), 0);
    tx2.addOutput(bitcoin.address.toOutputScript(await (0, btc_1.getnewaddress)(), network), amount2 - fee2);
    const sighash2 = tx2.hashForWitnessV0(0, (0, btc_1.p2pkh)(oneTimePrivs[0].publicKey), amount2, hashtype);
    tx2.setWitness(0, [
        bitcoin.script.signature.encode(ECPair.fromPrivateKey(oneTimePrivs[0].privateKey).sign(sighash2), hashtype),
        oneTimePrivs[0].publicKey
    ]);
    console.log('spend from one time address', tx2.toHex());
    await (0, btc_1.send)(tx2.toHex());
});
