const bitcoin = require('bitcoinjs-lib');
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const curve = require('tiny-secp256k1');
const ECPair = require('ecpair').ECPairFactory(curve);
const readline = require('readline');
const assert = require('assert');
const bs58 = require('bs58');
const mainnet = bitcoin.networks.bitcoin;
const testnet = bitcoin.networks.testnet;

bitcoin.networks.mainnet = mainnet;

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const input = q => new Promise(r => rl.question(q, r));

function pad(s, len) {
	return s + ' '.repeat(len - s.length);
}

const versions = [
	{ network: 'mainnet', version: Buffer.from('0488b21e', 'hex'), private: false, script: 'p2pkh or p2sh' },
	{ network: 'mainnet', version: Buffer.from('0488ade4', 'hex'), private: true,  script: 'p2pkh or p2sh' },
	{ network: 'mainnet', version: Buffer.from('049d7cb2', 'hex'), private: false, script: 'p2wpkh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('049d7878', 'hex'), private: true,  script: 'p2wpkh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('0295b43f', 'hex'), private: false, script: 'p2wsh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('0295b005', 'hex'), private: true,  script: 'p2wsh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('04b24746', 'hex'), private: false, script: 'p2wpkh' },
	{ network: 'mainnet', version: Buffer.from('04b2430c', 'hex'), private: true,  script: 'p2wpkh' },
	{ network: 'mainnet', version: Buffer.from('02aa7ed3', 'hex'), private: false, script: 'p2wsh' },
	{ network: 'mainnet', version: Buffer.from('02aa7a99', 'hex'), private: true,  script: 'p2wsh' },
	{ network: 'testnet', version: Buffer.from('043587cf', 'hex'), private: false, script: 'p2pkh or p2sh' },
	{ network: 'testnet', version: Buffer.from('04358394', 'hex'), private: true,  script: 'p2pkh or p2sh' },
	{ network: 'testnet', version: Buffer.from('044a5262', 'hex'), private: false, script: 'p2wpkh-p2sh' },
	{ network: 'testnet', version: Buffer.from('044a4e28', 'hex'), private: true,  script: 'p2wpkh-p2sh' },
	{ network: 'testnet', version: Buffer.from('024289ef', 'hex'), private: false, script: 'p2wsh-p2sh' },
	{ network: 'testnet', version: Buffer.from('024285b5', 'hex'), private: true,  script: 'p2wsh-p2sh' },
	{ network: 'testnet', version: Buffer.from('045f1cf6', 'hex'), private: false, script: 'p2wpkh' },
	{ network: 'testnet', version: Buffer.from('045f18bc', 'hex'), private: true,  script: 'p2wpkh' },
	{ network: 'testnet', version: Buffer.from('02575483', 'hex'), private: false, script: 'p2wsh' },
	{ network: 'testnet', version: Buffer.from('02575048', 'hex'), private: true,  script: 'p2wsh' }
];

function getNetwork(p) {
	var net;
	Object.entries(bitcoin.networks).forEach(n => {
		if (p(n[1])) {
			net = n[0];
		}
	});
	return net;
}

main();

async function main() {
	var i;
	if (process.argv.length > 2) {
		i = process.argv[2];
	} else {
		i = await input('Enter seed, xpriv or xpub\n> ');
	}

	// try extended key
	try {
		displayExtKey(i);
	}
	catch (e) {
	}

	// try seed
	const words = i.split(' ');
}

function displayExtKey(i) {
	const k = Buffer.from(bs58.decode(i));
	assert(k.length == 82);
	if (bitcoin.crypto.hash256(k.slice(0, 78)).compare(k, 78, 82, 0, 4)) {
		console.log('\033[31;1mWarning: Invalid checksum\033[0m');
	}

	const ver         = k.slice(0, 4);
	const depth       = k.readUInt8(4);
	const fingerprint = k.slice(5, 9);
	const n           = k.readUInt32BE(9);
	const chain       = k.slice(13, 45);
	const key         = k.slice(45, 78);

	console.log(`
Version:            ${ver.toString('hex')}
Depth:              ${depth}
Master fingerprint: ${fingerprint.toString('hex')}
Child number:       ${n & 0x7fffffff}${n & 0x80000000 ? `'`: ''}
Chain code:         ${chain.toString('hex')}
Key:                ${(key[0] ? key : key.slice(1)).toString('hex')}`);

	const type = versions.find(v => !v.version.compare(ver));

	if (type) {
		console.log(`
Network:            ${type.network}
Key type:           ${type.private ? 'private' : 'public'}
Script type:        ${type.script}`);
	}

	const
		BOLD = 1,
		REVERSED = 7,
		CYAN = 36;
	console.log(`
All Electrum defined master key versions:
Network     Key type     Script type     Key`);
	versions.forEach((v, i) => {
		v.version.copy(k);
		bitcoin.crypto.hash256(k.slice(0, 78)).copy(k, 78, 0, 4);
		const colors = [];
		if (i & 1) {
			colors.push(REVERSED);
		}
		if (v == type) {
			colors.push(BOLD, CYAN);
		}
		console.log(
			(colors.length ? `\x1b[${colors.join(';')}m` : '') +
			pad(v.network, 12) +
			pad(v.private ? 'private' : 'public', 13) +
			pad(v.script, 15) +
			bs58.encode(k) +
			(colors.length ? '\x1b[0m' : '')
		);
	});

	process.exit(0);
}
