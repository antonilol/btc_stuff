import * as bitcoin from 'bitcoinjs-lib';
import { createInterface } from 'readline';
import * as assert from 'assert';
import * as bs58 from 'bs58';

// TODO some key derivation, maybe these libs are needed
// import * as curve from 'tiny-secp256k1';
// import ECPairFactory from 'ecpair'
// const ECPair = ECPairFactory(curve);

const rl = createInterface({
	input: process.stdin,
	output: process.stdout
});

const input = (q: string): Promise<string> => new Promise(r => rl.question(q, r));
const pad = (s: string, len: number): string => s + ' '.repeat(len - s.length);
const color = (...colors: number[]): string => colors.length ? `\x1b[${colors.join(';')}m` : '';

const
	RESET = 0,
	BOLD = 1,
	REVERSED = 7,
	RED = 31,
	CYAN = 36;

interface Version {
	network: 'mainnet' | 'testnet',
	version: Buffer,
	private: boolean,
	script: 'p2pkh or p2sh' | 'p2wpkh-p2sh' | 'p2wsh-p2sh' | 'p2wpkh' | 'p2wsh'
}

const versions: Version[] = [
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

main();

async function main() {
	var i: string;
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
	// const words = i.split(' ');
	// ...
	console.error('Seed functionality not implemented yet');
	process.exit(38);
}

function displayExtKey(i: string) {
	const k = Buffer.from(bs58.decode(i));
	assert(k.length == 82);
	if (bitcoin.crypto.hash256(k.slice(0, 78)).compare(k, 78, 82, 0, 4)) {
		console.log(color(BOLD, RED) + 'Warning: Invalid checksum' + color(RESET));
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
			color(...colors) +
			pad(v.network, 12) +
			pad(v.private ? 'private' : 'public', 13) +
			pad(v.script, 15) +
			bs58.encode(k) +
			color(RESET)
		);
	});

	process.exit(0);
}
