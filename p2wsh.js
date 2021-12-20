const { send } = require('./btc');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;

function address(a) {
	return Buffer.from('0014' + bitcoin.address.fromBech32(a).data.toString('hex'), 'hex');
}

const witnessScript = bitcoin.script.compile([
	bitcoin.opcodes.OP_ADD,
	bitcoin.opcodes.OP_13,
	bitcoin.opcodes.OP_EQUAL
]);

console.log('Locking script: ' + witnessScript.toString('hex'));

const tx = new bitcoin.Transaction(network);

const txid = '1234....'; // txid hex here
const vout = 0;

tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);
tx.setWitness(0, [
	...[ '06', '07' ].map(x => Buffer.from(x, 'hex')),
	witnessScript
]);

const fee_sat = 100;
const input_sat = 1000;

tx.addOutput(address('tb1qbech32addresshere'), input_sat-fee_sat);

console.log(send(tx.toHex()));
