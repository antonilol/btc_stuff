const { send, bech32toScriptPubKey } = require('./btc')();
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;

const witnessScriptPiece = bitcoin.script.compile([
	bitcoin.opcodes.OP_OVER,
	bitcoin.opcodes.OP_SUB,
	bitcoin.opcodes.OP_1,
	bitcoin.opcodes.OP_EQUALVERIFY
]);

const l = witnessScriptPiece.length;

const witnessScriptEnd = bitcoin.script.compile([
	bitcoin.opcodes.OP_0,
	bitcoin.opcodes.OP_EQUAL
]);

const t = 17;

const witnessScript = Buffer.allocUnsafe(l * t + witnessScriptEnd.length);

for (var i = 0; i < t; i++) {
	witnessScriptPiece.copy(witnessScript, i * l);
}

witnessScriptEnd.copy(witnessScript, t * l);

console.log('Locking script: ' + witnessScript.toString('hex'));

console.log(
	'send 1000 sat to ' +
	bitcoin.payments.p2wsh({ redeem: { output: witnessScript, network }, network }).address
);

const tx = new bitcoin.Transaction(network);

const txid = '1234....'; // txid hex here
const vout = 0;

tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);
tx.setWitness(0, [
	...Array(t + 1).fill().map((x, i) => {
		// minimal encoding of data (https://bitcoin.stackexchange.com/a/111595/128539)
		// a zero must an empty Buffer
		if (i == 0) {
			return Buffer.allocUnsafe(0);
		}
		const b = Buffer.allocUnsafe(1);
		b.writeInt8(i);
		return b;
	}),
	witnessScript
]);

const fee_sat = 100;
const input_sat = 1000;

tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), input_sat-fee_sat);

send(tx.toHex()).then(console.log);
