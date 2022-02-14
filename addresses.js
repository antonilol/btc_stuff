const bitcoin = require('bitcoinjs-lib');
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const curve = require('tiny-secp256k1');
const ECPair = require('ecpair').ECPairFactory(curve);
const readline = require('readline');
const assert = require('assert');
const mainnet = bitcoin.networks.bitcoin;
const testnet = bitcoin.networks.testnet;

bitcoin.networks.mainnet = mainnet;

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const input = q => new Promise(r => rl.question(q, r));

function getNetwork(p) {
	var net;
	Object.entries(bitcoin.networks).forEach(n => {
		if (p(n[1])) {
			net = n[0];
		}
	});
	return net;
}

const data = {};

getData().then(fillData);

async function getData() {
	var i;
	if (process.argv.length > 2) {
		i = process.argv[2];
	} else {
		i = await input('Enter private key WIF or hex, public key or address\n> ');
	}

	try {
		const b32 = bitcoin.address.fromBech32(i);
		const network = getNetwork(n => n.bech32 == b32.prefix);
		if (!network) {
			console.log(`Unsupported network prefix ${b32.prefix}`);
			process.exit(1);
		}
		if (b32.version == 0) {
			if (b32.data.length == 20) {
				data.pkh = b32.data;
			} else if (b32.data.length == 32) {
				data.wsh = b32.data;
			} else {
				console.log(`Invalid Bech32 length`);
				process.exit(1);
			}
		} else {
			console.log(`Witness program version ${b32.version} not supported`);
			process.exit(1);
		}
		console.log(`Detected ${network} P2W${data.pkh ? 'PK' : 'S'}H bech32 address`);
		data.witness = true;
		return;
	}
	catch (e) {
	}

	try {
		const b58 = bitcoin.address.fromBase58Check(i);
		const pkh = getNetwork(n => n.pubKeyHash == b58.version);
		const sh  = getNetwork(n => n.scriptHash == b58.version);
		if (!pkh && !sh) {
			console.log(`Unknown base 58 version ${b58.version}`);
			process.exit(1);
		}
		if (pkh) {
			data.pkh = b58.hash;
		} else {
			data.sh = b58.hash;
		}
		console.log(`Detected ${pkh ? `${pkh} P2PK` : `${sh} P2S`}H base 58 address`);
		return;
	}
	catch (e) {
	}

	try {
		assert(i.length == 32 * 2);
		data.ec = ECPair.fromPrivateKey(Buffer.from(i, 'hex'));
		console.log(`Detected hex private key`);
		return;
	}
	catch (e) {
	}

	try {
		data.ec = ECPair.fromWIF(i);
		console.log(`Detected mainnet WIF private key`);
		return;
	}
	catch (e) {
	}

	try {
		data.ec = ECPair.fromWIF(i, testnet);
		console.log(`Detected testnet WIF private key`);
		return;
	}
	catch (e) {
	}

	try {
		assert(i.length == 33 * 2 || i.length == 65 * 2);
		data.ec = ECPair.fromPublicKey(Buffer.from(i, 'hex'));
		console.log(`Detected hex public key`);
		return;
	}
	catch (e) {
	}

	console.log(`Error: nothing detected`);
	process.exit(1);
}

function fillData() {
	if (data.ec) {
		const ec = data.ec;
		if (ec.__D) {
			data.priv = ec.__D;
		}
		data.pubu = Buffer.from(curve.pointCompress(ec.publicKey, false));
		data.pub  = Buffer.from(curve.pointCompress(ec.publicKey, true));
	}

	if (data.pub) {
		data.pkh  = bitcoin.crypto.hash160(data.pub);
		data.pkhu = bitcoin.crypto.hash160(data.pubu);
	}

	if (data.wsh) {
		data.sh = bitcoin.crypto.ripemd160(data.wsh);
	}

	if (data.priv) {
		console.log('\nPrivate key');
		data.ec.network = mainnet;
		data.ec.compressed = true;
		console.log(` Mainnet WIF (compressed public key):   ${data.ec.toWIF()}`);
		data.ec.network = mainnet;
		data.ec.compressed = false;
		console.log(` Mainnet WIF (uncompressed public key): ${data.ec.toWIF()}`);
		data.ec.network = testnet;
		data.ec.compressed = true;
		console.log(` Testnet WIF (compressed public key):   ${data.ec.toWIF()}`);
		data.ec.network = testnet;
		data.ec.compressed = false;
		console.log(` Testnet WIF (uncompressed public key): ${data.ec.toWIF()}`);
		console.log(` Hex:                                   ${data.priv.toString('hex')}`);
	}

	if (data.pub) {
		console.log('\nPublic key');
		console.log(` Compressed:   ${data.pub.toString('hex')}`);
		console.log(` Uncompressed: ${data.pubu.toString('hex')}`);
	}

	if (data.pub) {
		console.log('\nPublic Key Hash');
		console.log(` Mainnet P2PKH (compressed public key):   ${bitcoin.address.toBase58Check(data.pkh,  mainnet.pubKeyHash)}`);
		console.log(` Mainnet P2PKH (uncompressed public key): ${bitcoin.address.toBase58Check(data.pkhu, mainnet.pubKeyHash)}`);
		console.log(` Mainnet P2WPKH (compressed public key):  ${bitcoin.address.toBech32(data.pkh, 0, mainnet.bech32)}`);
		console.log(` Testnet P2PKH (compressed public key):   ${bitcoin.address.toBase58Check(data.pkh,  testnet.pubKeyHash)}`);
		console.log(` Testnet P2PKH (uncompressed public key): ${bitcoin.address.toBase58Check(data.pkhu, testnet.pubKeyHash)}`);
		console.log(` Testnet P2WPKH (compressed public key):  ${bitcoin.address.toBech32(data.pkh, 0, testnet.bech32)}`);
		console.log(` Hex (compressed public key):             ${data.pkh.toString('hex')}`);
		console.log(` Hex (uncompressed public key):           ${data.pkhu.toString('hex')}`);
	} else if (data.pkh) {
		console.log('\nPublic Key Hash');
		console.log(` Mainnet P2PKH:   ${bitcoin.address.toBase58Check(data.pkh,  mainnet.pubKeyHash)}`);
		console.log(` Mainnet P2WPKH:  ${bitcoin.address.toBech32(data.pkh, 0, mainnet.bech32)}`);
		console.log(` Testnet P2PKH:   ${bitcoin.address.toBase58Check(data.pkh,  testnet.pubKeyHash)}`);
		console.log(` Testnet P2WPKH:  ${bitcoin.address.toBech32(data.pkh, 0, testnet.bech32)}`);
		console.log(` Hex:             ${data.pkh.toString('hex')}`);
	}

	if (data.sh || data.pkh) {
		console.log('\nScript Hash');
		var nwsh, nwpkh;
		if (data.wsh) {
			nwsh = bitcoin.crypto.hash160(bitcoin.script.compile([ 0, data.wsh ]));
			console.log(` Mainnet P2WSH:       ${bitcoin.address.toBech32(data.wsh, 0, mainnet.bech32)}`);
			console.log(` Mainnet P2SH-P2WSH:  ${bitcoin.address.toBase58Check(nwsh,  mainnet.scriptHash)}`);
		}
		if (data.sh) {
			console.log(` Mainnet P2SH:        ${bitcoin.address.toBase58Check(data.sh,  mainnet.scriptHash)}`);
		}
		if (data.pkh) {
			nwpkh = bitcoin.crypto.hash160(bitcoin.script.compile([ 0, data.pkh ]));
			console.log(` Mainnet P2SH-P2WPKH: ${bitcoin.address.toBase58Check(nwpkh,  mainnet.scriptHash)}`);
		}
		if (data.wsh) {
			console.log(` Testnet P2WSH:       ${bitcoin.address.toBech32(data.wsh, 0, testnet.bech32)}`);
			console.log(` Testnet P2SH-P2WSH:  ${bitcoin.address.toBase58Check(nwsh,  testnet.scriptHash)}`);
		}
		if (data.sh) {
			console.log(` Testnet P2SH:        ${bitcoin.address.toBase58Check(data.sh,  testnet.scriptHash)}`);
		}
		if (data.pkh) {
			console.log(` Testnet P2SH-P2WPKH: ${bitcoin.address.toBase58Check(nwpkh,  testnet.scriptHash)}`);
		}
	}

	if (data.pub) {
		console.log('\n\033[1m(!) Note: Witness Public Key Hash with uncompressed keys are not shown because\n          using uncompressed keys in SegWit makes the transaction non-standard\033[0m');
	} else if (data.pkh && !data.witness) {
		console.log('\n\033[1;33m(!) Warning: Compression of the public key is unknown\n             Using uncompressed keys in SegWit makes the transaction non-standard\033[0m');
	}

	process.exit(0);
}
