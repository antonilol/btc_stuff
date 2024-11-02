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
const curve = __importStar(require("tiny-secp256k1"));
const bitcoin = __importStar(require("bitcoinjs-lib"));
const btc_1 = require("./btc");
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const ecpair_1 = require("ecpair");
const ecdh_stealth_1 = require("./ecdh_stealth");
(0, btc_1.setChain)('regtest');
const network = bitcoin.networks.regtest;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
// generate a random address and test toString, fromString and derived addresses
const priv = new ecdh_stealth_1.StealthAddress((0, crypto_1.randomBytes)(32));
(0, assert_1.strict)(priv.strictEquals(ecdh_stealth_1.StealthAddress.fromString(priv.toString())));
const watchonly = new ecdh_stealth_1.StealthAddress(priv.spendPub, priv.viewPriv);
(0, assert_1.strict)(watchonly.strictEquals(ecdh_stealth_1.StealthAddress.fromString(watchonly.toString())));
(0, assert_1.strict)(watchonly.equals(priv));
const pub = new ecdh_stealth_1.StealthAddress(priv.spendPub, priv.viewPub);
const pub2 = new ecdh_stealth_1.StealthAddress(watchonly.spendPub, watchonly.viewPub);
(0, assert_1.strict)(pub.strictEquals(ecdh_stealth_1.StealthAddress.fromString(pub.toString())));
(0, assert_1.strict)(pub2.strictEquals(ecdh_stealth_1.StealthAddress.fromString(pub2.toString())));
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
        oneTimePrivs[0].publicKey,
    ]);
    console.log('spend from one time address', tx2.toHex());
    await (0, btc_1.send)(tx2.toHex());
});
