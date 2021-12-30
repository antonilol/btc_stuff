const { send } = require('./btc');
const { bech32toLockingScript } = require('./btc2');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;

const redeemScript = bitcoin.script.compile([
	bitcoin.opcodes.OP_ADD,
	bitcoin.opcodes.OP_13,
	bitcoin.opcodes.OP_EQUAL
]);

console.log('Locking script: ' + redeemScript.toString('hex'));

const tx = new bitcoin.Transaction(network);

const txid = '1234....'; // txid hex here
const vout = 0;

tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);

tx.setInputScript(0, bitcoin.script.compile([
	bitcoin.opcodes.OP_6,
	bitcoin.opcodes.OP_7,
	redeemScript
]));

const fee_sat = 100;
const input_sat = 1000;

tx.addOutput(bech32toLockingScript('tb1qbech32addresshere'), input_sat-fee_sat);

console.log(send(tx.toHex()));
