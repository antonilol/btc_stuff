import { input } from './btc';
import * as bitcoin from 'bitcoinjs-lib';
import { strict as assert } from 'assert';
import * as bs58 from 'bs58';
import BIP32Factory, { BIP32Interface } from 'bip32';
import * as curve from 'tiny-secp256k1';

const bip32 = BIP32Factory(curve);

const pad = (s: string, len: number): string => s + ' '.repeat(len - s.length);
const color = (...colors: number[]): string => (colors.length ? `\x1b[${colors.join(';')}m` : '');
const checksum = (key: Buffer) => bitcoin.crypto.hash256(key.slice(0, 78)).copy(key, 78, 0, 4);

const RESET = 0;
const BOLD = 1;
const REVERSED = 7;
const RED = 31;
const CYAN = 36;

interface Version {
	network: 'mainnet' | 'testnet';
	version: Buffer;
	private: boolean;
	script: 'p2pkh or p2sh' | 'p2wpkh-p2sh' | 'p2wsh-p2sh' | 'p2wpkh' | 'p2wsh';
}

const versions: Version[] = [
	{ network: 'mainnet', version: Buffer.from('0488b21e', 'hex'), private: false, script: 'p2pkh or p2sh' },
	{ network: 'mainnet', version: Buffer.from('0488ade4', 'hex'), private: true, script: 'p2pkh or p2sh' },
	{ network: 'mainnet', version: Buffer.from('049d7cb2', 'hex'), private: false, script: 'p2wpkh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('049d7878', 'hex'), private: true, script: 'p2wpkh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('0295b43f', 'hex'), private: false, script: 'p2wsh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('0295b005', 'hex'), private: true, script: 'p2wsh-p2sh' },
	{ network: 'mainnet', version: Buffer.from('04b24746', 'hex'), private: false, script: 'p2wpkh' },
	{ network: 'mainnet', version: Buffer.from('04b2430c', 'hex'), private: true, script: 'p2wpkh' },
	{ network: 'mainnet', version: Buffer.from('02aa7ed3', 'hex'), private: false, script: 'p2wsh' },
	{ network: 'mainnet', version: Buffer.from('02aa7a99', 'hex'), private: true, script: 'p2wsh' },
	{ network: 'testnet', version: Buffer.from('043587cf', 'hex'), private: false, script: 'p2pkh or p2sh' },
	{ network: 'testnet', version: Buffer.from('04358394', 'hex'), private: true, script: 'p2pkh or p2sh' },
	{ network: 'testnet', version: Buffer.from('044a5262', 'hex'), private: false, script: 'p2wpkh-p2sh' },
	{ network: 'testnet', version: Buffer.from('044a4e28', 'hex'), private: true, script: 'p2wpkh-p2sh' },
	{ network: 'testnet', version: Buffer.from('024289ef', 'hex'), private: false, script: 'p2wsh-p2sh' },
	{ network: 'testnet', version: Buffer.from('024285b5', 'hex'), private: true, script: 'p2wsh-p2sh' },
	{ network: 'testnet', version: Buffer.from('045f1cf6', 'hex'), private: false, script: 'p2wpkh' },
	{ network: 'testnet', version: Buffer.from('045f18bc', 'hex'), private: true, script: 'p2wpkh' },
	{ network: 'testnet', version: Buffer.from('02575483', 'hex'), private: false, script: 'p2wsh' },
	{ network: 'testnet', version: Buffer.from('02575048', 'hex'), private: true, script: 'p2wsh' }
];

let i: string,
	k: Buffer,
	ver: Buffer,
	depth: number,
	fingerprint: Buffer,
	n: number,
	chain: Buffer,
	key: Buffer,
	type: Version,
	bip32key: BIP32Interface;
async function main() {
	while (true) {
		i = await input(
			`\nEnter master/extended key to load or a command${i ? '' : ` (type 'help' for a list of commands)`}\n> `
		);
		if (!i) {
			continue;
		}
		const args = i.split(' ');

		if (args[0] == 'help') {
			console.log(`
Commands:
	help: show this list
	exit: exit
	load <key>: loads a key
	derive <path>: derive the loaded key to a new one. loads the new one
	info: displays information about the loaded key`);
		} else if (args[0] == 'exit') {
			process.exit(0);
		} else if (args[0] == 'load') {
			if (args.length > 1) {
				if (readKey(args[1])) {
					console.log('Key loaded');
				}
			} else {
				console.log('load requires an argument <key>');
			}
		} else if (args[0] == 'derive') {
			if (args.length > 1) {
				if (derive(args[1])) {
					console.log(`New key loaded: ${bs58.encode(k)}`);
				}
			} else {
				console.log('derive requires an argument <path>');
			}
		} else if (args[0] == 'info') {
			displayKey();
		} else {
			if (readKey(args[0])) {
				console.log('Key loaded');
			}
		}
	}
}

function derive(path: string): boolean {
	try {
		bip32key = bip32key.derivePath(path);
	} catch (e) {
		console.log(e.message);
		return false;
	}

	readKey(bip32key.toBase58(), true);

	return true;
}

function loadKey(s: string): boolean {
	try {
		k = Buffer.from(bs58.decode(s));
		assert(k.length == 82);
	} catch (e) {
		console.log('Invalid input');
		k = undefined;
		return false;
	}

	if (bitcoin.crypto.hash256(k.slice(0, 78)).compare(k, 78, 82, 0, 4)) {
		console.log(color(BOLD, RED) + 'Error: Invalid checksum' + color(RESET));
		checksum(k);
		console.log('Key with recalculated checksum (only use if you know what you are doing!):\n' + bs58.encode(k));
		k = undefined;
		return false;
	}

	return true;
}

function readKey(s: string, useOldVersion = false): boolean {
	if (!loadKey(s)) {
		return false;
	}

	if (useOldVersion) {
		ver.copy(k);
		checksum(k);
	} else {
		ver = k.slice(0, 4);
	}
	depth = k.readUint8(4);
	fingerprint = k.slice(5, 9);
	n = k.readUint32BE(9);
	chain = k.slice(13, 45);
	key = k.slice(45, 78);

	type = versions.find(v => !v.version.compare(ver));
	if (!type) {
		console.log(`Invalid version: 0x${ver.toString('hex')}`);
		return false;
	}

	if (!useOldVersion) {
		const clone = Buffer.allocUnsafe(82);
		k.copy(clone, 4, 4, 78);
		versions.find(v => v.private == type.private && v.network == type.network).version.copy(clone);
		checksum(clone);

		bip32key = bip32.fromBase58(
			bs58.encode(clone),
			type.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
		);
	}

	return true;
}

function displayKey() {
	if (!k) {
		console.log('No key loaded');
		return;
	}

	console.log(`
Version:              ${ver.toString('hex')}
Depth:                ${depth}
Master fingerprint:   ${fingerprint.toString('hex')}
Child number:         ${n & 0x7fffffff}${n & 0x80000000 ? `'` : ''}
Chain code:           ${chain.toString('hex')}
Key:                  ${(key[0] ? key : key.slice(1)).toString('hex')}

Network:              ${type.network}
Key type:             ${type.private ? 'private' : 'public'}
Electrum script type: ${type.script}

All Electrum defined master key versions:
Network     Key type     Script type     Key`);
	versions
		.filter(v => v.private == type.private)
		.forEach((v, i) => {
			v.version.copy(k);
			checksum(k);
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
}

main();
