"use strict";
exports.__esModule = true;
var curve = require("tiny-secp256k1");
var bitcoin = require("bitcoinjs-lib");
var btc_1 = require("./btc");
var ecpair_1 = require("ecpair");
var ECPair = (0, ecpair_1.ECPairFactory)(curve);
var network = bitcoin.networks.testnet;
var hashtype = bitcoin.Transaction.SIGHASH_DEFAULT;
// when you f*cked up a script taproot keyspend can save your coins!
var keyspend = false;
var ecpair1 = ECPair.fromPrivateKey(bitcoin.crypto.sha256(Buffer.from('<slam head on your keyboard for more randomness>addsadadasdads')));
ecpair1.network = network;
var ecpair2 = ECPair.fromPrivateKey(bitcoin.crypto.sha256(Buffer.from('<slam head on your keyboard for more randomness>asdasdasdasd')));
ecpair2.network = network;
function tapLeaf(script) {
    return bitcoin.crypto.taggedHash('TapLeaf', Buffer.concat([Buffer.from([0xc0, script.length]), script]));
}
function tapBranch(branch1, branch2) {
    return bitcoin.crypto.taggedHash('TapBranch', Buffer.concat(branch1 < branch2 ? [branch1, branch2] : [branch2, branch1]));
}
function tapTweak(pubkey, branch) {
    return bitcoin.crypto.taggedHash('TapTweak', Buffer.concat([pubkey.slice(-32), branch]));
}
var script = bitcoin.script.compile([
    ecpair2.publicKey.slice(1, 33),
    bitcoin.opcodes.OP_CHECKSIG,
    ecpair2.publicKey.slice(1, 33),
    0xba,
    bitcoin.opcodes.OP_2,
    bitcoin.opcodes.OP_EQUAL
]);
var leaf = tapLeaf(script);
// Order of the curve (N) - 1
var N_LESS_1 = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140', 'hex');
// 1 represented as 32 bytes BE
var ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
var tweak = tapTweak(ecpair1.publicKey, tapBranch(leaf, Buffer.alloc(32))); // Buffer.alloc(32) zero-allocates 32 bytes (a 0 uint256)
function createOutput(publicKey) {
    // x-only pubkey (remove 1 byte y parity)
    var myXOnlyPubkey = publicKey.slice(1, 33);
    var tweakResult = curve.xOnlyPointAddTweak(myXOnlyPubkey, tweak);
    if (tweakResult === null)
        throw new Error('Invalid Tweak');
    var tweaked = tweakResult.xOnlyPubkey;
    // incomplete scriptPubkey
    return Buffer.from(tweaked);
}
function sign(messageHash, key) {
    var privateKey = key.publicKey[0] === 2
        ? key.privateKey
        : curve.privateAdd(curve.privateSub(N_LESS_1, key.privateKey), ONE);
    var newPrivateKey = curve.privateAdd(privateKey, tweak);
    if (newPrivateKey === null)
        throw new Error('Invalid Tweak');
    return Buffer.from(curve.signSchnorr(messageHash, newPrivateKey));
}
var tr = createOutput(ecpair1.publicKey);
console.log("send 1000 sats to ".concat(bitcoin.address.toBech32(tr, 1, network.bech32)));
var tx = new bitcoin.Transaction();
var txid = '1234....'; // txid hex here
var vout = 0;
tx.version = 2;
tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);
var fee_sat = 150;
var input_sat = 10000;
tx.addOutput((0, btc_1.bech32toScriptPubKey)('tb1qbech32addresshere'), input_sat - fee_sat);
var sighash = tx.hashForWitnessV1(0, // which input
[
    bitcoin.script.compile([
        bitcoin.opcodes.OP_1,
        tr
    ])
], // All previous outputs of all inputs
[input_sat], // All previous values of all inputs
hashtype, // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
keyspend ? undefined : leaf);
if (keyspend) {
    var signature = sign(sighash, ecpair1);
    tx.setWitness(0, [signature]);
}
else {
    var signature = Buffer.from(curve.signSchnorr(sighash, ecpair2.privateKey));
    var pub = ecpair1.publicKey;
    pub.writeUint8(0xc0 | (pub[0] & 1));
    var ctrl = Buffer.concat([pub, Buffer.alloc(32)]);
    tx.setWitness(0, [
        signature,
        signature,
        script,
        ctrl
    ]);
}
console.log(tx.toHex());
(0, btc_1.send)(tx.toHex()).then(console.log);
