const { btc, send, bech32toScriptPubKey } = require('./btc');
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const curve = require('tiny-secp256k1')
const ECPair = require('ecpair').ECPairFactory(curve);

// 2 wallet addresses
const addrs = [
	'tb1qbech32addresshere',
	'tb1qbech32addresshere'
];

main();

async function main() {
	const addrInfo1 = btc('getaddressinfo', addrs[0]);
	const addrInfo2 = btc('getaddressinfo', addrs[1]);

	const pub1 = Buffer.from(JSON.parse(await addrInfo1).pubkey, 'hex');
	const pub2 = Buffer.from(JSON.parse(await addrInfo2).pubkey, 'hex');

	const pub = curve.pointAdd(pub1, pub2);
	const pkh = bitcoin.crypto.hash160(pub);

	console.log(`send 1000 sat to ${bitcoin.address.toBech32(pkh, 0, network.bech32)}`);

	const tx = new bitcoin.Transaction(network);

	const txid = '1234....'; // txid hex here
	const vout = 0;

	tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);

	const fee_sat = 110;
	const input_sat = 1000;

	tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), input_sat-fee_sat);

	const sighash = tx.hashForWitnessV0(
		0,
		bitcoin.script.compile([
			bitcoin.opcodes.OP_DUP,
			bitcoin.opcodes.OP_HASH160,
			pkh,
			bitcoin.opcodes.OP_EQUALVERIFY,
			bitcoin.opcodes.OP_CHECKSIG,
		]),
		input_sat,
		hashtype
	);

	// get privkeys and add them
	const wif1 = btc('dumpprivkey', addrs[0]);
	const wif2 = btc('dumpprivkey', addrs[1]);

	const priv1 = ECPair.fromWIF(await wif1, network).privateKey;
	const priv2 = ECPair.fromWIF(await wif2, network).privateKey;

	const ecpair = ECPair.fromPrivateKey(Buffer.from(curve.privateAdd(priv1, priv2)));

	tx.setWitness(0, [
		bitcoin.script.signature.encode(ecpair.sign(sighash), hashtype),
		ecpair.publicKey
	]);

	console.log(await send(tx.toHex()));
}
