const { send, bech32toScriptPubKey } = require('./btc')();
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));

const redeemScript = Buffer.from('ac919191919191919191919191919191919191910087', 'hex');

// brainwallet with passphrase 'satoshi'
const ecpair = ECPair.fromPrivateKey(
	bitcoin.crypto.sha256(Buffer.from('satoshi'))
);
ecpair.network = network;

const tx = new bitcoin.Transaction(network);

const txid = '1234....'; // txid hex here
const vout = 0;

tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);

const fee_sat = 100;
const input_sat = 1000;

tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), input_sat-fee_sat);

tx.addOutput(bitcoin.script.compile([
	bitcoin.opcodes.OP_RETURN,
	Buffer.from('lol signed by satoshi')
]), 0);

const sighash = tx.hashForSignature(0, redeemScript, hashtype);
tx.setInputScript(0, bitcoin.script.compile([
	bitcoin.script.signature.encode(ecpair.sign(sighash), hashtype),
	ecpair.publicKey
]));

send(tx.toHex()).then(console.log);
