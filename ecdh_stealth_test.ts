import * as curve from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { send, setChain, getnewaddress, fundOutputScript, p2pkh } from './btc';
import { randomBytes } from 'crypto';
import { strict as assert } from 'assert';
import { ECPairFactory } from 'ecpair';
import { StealthAddress } from './ecdh_stealth';

setChain('regtest');

const network = bitcoin.networks.regtest;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = ECPairFactory(curve);

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
const p2wpkh = bitcoin.script.compile([0, bitcoin.crypto.hash160(ecpair.publicKey)]);
fundOutputScript(p2wpkh, amount1).then(async funding => {
    console.log('funding', funding.hex);

    // send to `pub`
    const tx1 = new bitcoin.Transaction();

    tx1.addInput(funding.txidBytes, funding.vout);

    const oneTimeKey = pub.deriveOneTimeKey(ecpair.privateKey, funding.txidBytes, funding.vout, 0).publicKey;
    tx1.addOutput(bitcoin.script.compile([0, bitcoin.crypto.hash160(oneTimeKey)]), amount1 - fee1);

    const sighash1 = tx1.hashForWitnessV0(0, p2pkh(ecpair.publicKey), amount1, hashtype);

    tx1.setWitness(0, [bitcoin.script.signature.encode(ecpair.sign(sighash1), hashtype), ecpair.publicKey]);

    console.log('pay to one time address', tx1.toHex());
    await send(tx1.toHex());

    // check public key with `watchonly`
    const oneTimePubs = watchonly.deriveOneTimeKeys(ecpair.publicKey, tx1);
    assert(oneTimePubs.length === 1 && oneTimePubs[0].type === 'p2wpkh' && oneTimePubs[0].publicKey.equals(oneTimeKey));

    // check spending with `priv`
    const oneTimePrivs = priv.deriveOneTimeKeys(ecpair.publicKey, tx1);
    assert(
        oneTimePrivs.length === 1 && oneTimePrivs[0].type === 'p2wpkh' && oneTimePrivs[0].publicKey.equals(oneTimeKey),
    );

    const tx2 = new bitcoin.Transaction();

    tx2.addInput(Buffer.from(tx1.getId(), 'hex').reverse(), 0);

    tx2.addOutput(bitcoin.address.toOutputScript(await getnewaddress(), network), amount2 - fee2);

    const sighash2 = tx2.hashForWitnessV0(0, p2pkh(oneTimePrivs[0].publicKey), amount2, hashtype);

    tx2.setWitness(0, [
        bitcoin.script.signature.encode(ECPair.fromPrivateKey(oneTimePrivs[0].privateKey).sign(sighash2), hashtype),
        oneTimePrivs[0].publicKey,
    ]);

    console.log('spend from one time address', tx2.toHex());
    await send(tx2.toHex());
});
