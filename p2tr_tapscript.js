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
const bitcoin = __importStar(require("bitcoinjs-lib"));
const crypto_1 = require("crypto");
const ecpair_1 = require("ecpair");
const curve = __importStar(require("tiny-secp256k1"));
const btc_1 = require("./btc");
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_DEFAULT;
const internalKey = ECPair.fromPrivateKey((0, btc_1.negateIfOddPubkey)((0, crypto_1.randomBytes)(32)), { network });
const ecpair2 = ECPair.makeRandom({ network });
// build taptree
const leaf1script = bitcoin.script.compile([
    ecpair2.publicKey.slice(1, 33),
    bitcoin.opcodes.OP_CHECKSIG,
    ecpair2.publicKey.slice(1, 33),
    btc_1.OP_CHECKSIGADD,
    bitcoin.opcodes.OP_2,
    bitcoin.opcodes.OP_EQUAL,
]);
const leaf1 = (0, btc_1.tapLeaf)(leaf1script);
const leaf2 = Buffer.alloc(32); // all zeros
const branch = (0, btc_1.tapBranch)(leaf1, leaf2);
const tr = (0, btc_1.createTaprootOutput)(internalKey.publicKey, branch);
const fee_sat = 162;
const input_sat = 1000;
console.log(tr.address);
(0, btc_1.fundAddress)(tr.address, input_sat).then(async (outpoint) => {
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    tx.addInput(Buffer.from(outpoint.txid, 'hex').reverse(), outpoint.vout);
    tx.addOutput((0, btc_1.bech32toScriptPubKey)(await (0, btc_1.getnewaddress)()), input_sat - fee_sat);
    const sighash = tx.hashForWitnessV1(0, // which input
    [tr.scriptPubKey], // All previous outputs of all inputs
    [input_sat], // All previous values of all inputs
    hashtype, // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
    leaf1);
    const signature = ecpair2.signSchnorr(sighash);
    const pub = internalKey.publicKey;
    pub.writeUint8(0xc0 | tr.parity);
    const ctrl = Buffer.concat([pub, leaf2]);
    tx.setWitness(0, [signature, signature, leaf1script, ctrl]);
    const decoded = await (0, btc_1.decodeRawTransaction)(tx.toHex());
    console.log(JSON.stringify(decoded, null, 2));
    console.log(tx.toHex());
    await (0, btc_1.send)(tx.toHex());
    console.log('sendrawtransaction successful');
});
