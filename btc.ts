import { spawn } from 'child_process';
import * as bitcoin from 'bitcoinjs-lib';
import * as curve from 'tiny-secp256k1';
import { createInterface } from 'readline';
import { Writable } from 'stream';

const ZERO = Buffer.alloc(32);
const ONE = Buffer.from(ZERO.map((_, i) => (i == 31 ? 1 : 0)));
const TWO = Buffer.from(ZERO.map((_, i) => (i == 31 ? 2 : 0)));
const N_LESS_1 = Buffer.from(curve.privateSub(ONE, TWO));

export interface OutputPoint {
	txid: string;
	vout: number;
}

export interface UTXO extends OutputPoint {
	address: string;
	label?: string;
	scriptPubKey: string;
	amount: number;
	confirmations: number;
	ancestorcount?: number;
	ancestorsize?: number;
	ancestorfees?: number;
	redeemScript?: string;
	witnessScript?: string;
	spendable: boolean;
	solvable: boolean;
	reused?: boolean;
	desc?: string;
	safe: boolean;
}

export interface RawTransactionInput extends OutputPoint {
	sequence?: number;
}

export type RawTransactionOutput =
	| {
			[address: string]: number;
	  }
	| {
			data: string;
	  };

export interface TemplateRequest {
	mode?: string;
	capabilities?: string[];
	rules: string[];
}

export interface BlockTemplateTX {
	data: string;
	txid: string;
	hash: string;
	depends: number[];
	TXdepends: BlockTemplateTX[];
	fee?: number;
	sigops?: number;
	weight: number;
}

export interface BlockTemplate {
	capabilities: string[];
	version: number;
	rules: string[];
	vbavailable: { [rulename: string]: number };
	vbrequired: number;
	previousblockhash: string;
	transactions: BlockTemplateTX[];
	coinbaseaux: { [key: string]: number };
	coinbasevalue: number;
	longpollid: string;
	target: string;
	mintime: number;
	mutable: string[];
	noncerange: string;
	sigoplimit: number;
	sizelimit: number;
	weightlimit: number;
	curtime: number;
	bits: string;
	height: number;
	signet_challenge?: string;
	default_witness_commitment?: string;
}

export type ScriptType =
	| 'nonstandard'
	| 'pubkey'
	| 'pubkeyhash'
	| 'scripthash'
	| 'multisig'
	| 'nulldata'
	| 'witness_v0_scripthash'
	| 'witness_v0_keyhash'
	| 'witness_v1_taproot'
	| 'witness_unknown';

export interface ScriptPubKey {
	asm: string;
	desc: string;
	hex: string;
	type: ScriptType;
	address?: string;
}

export interface Vin {
	coinbase?: string;
	txid?: string;
	vout?: number;
	scriptSig?: {
		asm: string;
		hex: string;
	};
	txinwitness?: string[];
	sequence: number;
}

export interface Vout {
	value: number;
	n: number;
	scriptPubKey: ScriptPubKey;
}

export interface RawTransaction {
	txid: string;
	hash: string;
	size: number;
	vsize: number;
	weight: number;
	version: number;
	locktime: number;
	vin: Vin[];
	vout: Vout[];
}

export interface TXOut {
	bestblock: string;
	confirmations: number;
	value: number;
	scriptPubKey: ScriptPubKey;
	coinbase: boolean;
}

export type Chain = 'main' | 'test' | 'regtest' | 'signet';

export const networks: { [name in Chain]: bitcoin.networks.Network } = {
	main: bitcoin.networks.bitcoin,
	test: bitcoin.networks.testnet,
	regtest: bitcoin.networks.regtest,
	signet: bitcoin.networks.testnet
};

var chain: Chain = 'test';
export var network = networks[chain];

export async function btc(...args: (string | Buffer | number | {})[]): Promise<string> {
	return new Promise((r, e) => {
		const cmdargs = [ `-chain=${chain}`, '-stdin' ];
		while (args.length && typeof args[0] === 'string' && args[0].startsWith('-')) {
			cmdargs.push(args.shift() as string);
		}

		const p = spawn('bitcoin-cli', cmdargs);

		var out = '';

		p.stdout.setEncoding('utf8');
		p.stdout.on('data', data => {
			out += data.toString();
		});

		p.stderr.setEncoding('utf8');
		p.stderr.on('data', data => {
			out += data.toString();
		});

		p.on('close', code => {
			while (out.endsWith('\n')) {
				out = out.slice(0, -1);
			}
			(code ? e : r)(out);
		});

		p.stdin.write(
			args
				.map(x => {
					var arg: string;
					if (Buffer.isBuffer(x)) {
						arg = x.toString('hex');
					} else if (typeof x === 'number') {
						arg = x.toString();
					} else if (typeof x === 'string') {
						arg = x;
					} else {
						arg = JSON.stringify(x);
					}
					return arg.replace(/\n/g, '');
				})
				.join('\n')
		);
		p.stdin.end();
	});
}

// sign, create and send new transaction
export async function newtx(
	inputs: RawTransactionInput[],
	outputs: RawTransactionOutput[],
	sat: boolean
): Promise<string> {
	if (sat) {
		Object.keys(outputs).forEach(k => {
			if (k !== 'data') {
				outputs[k] = parseFloat((outputs[k] * 1e-8).toFixed(8));
			}
		});
	}
	const tx = await btc('createrawtransaction', inputs, outputs);
	return signAndSend(tx);
}

export async function signAndSend(hex: string): Promise<string> {
	return send(JSON.parse(await btc('signrawtransactionwithwallet', hex)).hex);
}

export async function fundTransaction(
	tx: bitcoin.Transaction
): Promise<{ tx: bitcoin.Transaction; fee: number; changepos: number }> {
	const res = JSON.parse(await btc('fundrawtransaction', tx.toHex()));

	res.tx = bitcoin.Transaction.fromHex(res.hex);
	delete res.hex;

	return res;
}

export async function send(hex: string): Promise<string> {
	return btc('sendrawtransaction', hex);
}

export async function listunspent(minamount: number, minconf: number, sat: boolean): Promise<UTXO[]> {
	return JSON.parse(
		await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`)
	).map((u: UTXO) => {
		if (sat) {
			u.amount = Math.round(u.amount * 1e8);
		}
		return u;
	});
}

export async function getnewaddress(): Promise<string> {
	return btc('getnewaddress');
}

export async function getBlockTemplate(
	template_request: TemplateRequest = { rules: [ 'segwit' ] }
): Promise<BlockTemplate> {
	const template: BlockTemplate = JSON.parse(await btc('getblocktemplate', template_request));
	updateTXDepends(template);
	return template;
}

export async function decodeRawTransaction(txHex: string | Buffer): Promise<RawTransaction> {
	return JSON.parse(await btc('decoderawtransaction', txHex));
}

export async function getTXOut(txid: string | Buffer, vout: number, include_mempool = true): Promise<TXOut | void> {
	const txout = await btc('gettxout', txidToString(txid), vout, include_mempool);
	if (txout) {
		return JSON.parse(txout);
	}
}

// export function fundScript(scriptPubKey: Buffer, amount: number): Promise<UTXO | void> { /* TODO */ }

export async function fundAddress(address: string, amount: number): Promise<OutputPoint> {
	// return fundScript(bitcoin.address.toOutputScript(address, network), amount);

	const txid = await btc('sendtoaddress', address, toBTC(amount));
	const vout = JSON.parse(await btc('gettransaction', txid)).details.find(x => x.address == address).vout;

	return { txid, vout };
}

export function validNetworks(address: string): { [name in 'bitcoin' | 'testnet' | 'regtest']?: bitcoin.Network } {
	const output = {};

	for (const net of Object.entries(bitcoin.networks)) {
		try {
			bitcoin.address.toOutputScript(address, net[1]);
			output[net[0]] = net[1];
		} catch (e) {}
	}

	return output;
}

export const OP_CHECKSIGADD = 0xba; // this is not merged yet: https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742

export function schnorrPrivKey(d: Uint8Array): Buffer {
	if (curve.pointFromScalar(d, true)[0] == 3) {
		return Buffer.from(curve.privateAdd(curve.privateSub(N_LESS_1, d), ONE));
	}
	return Buffer.from(d);
}

export function tapLeaf(script: Buffer): Buffer {
	return bitcoin.crypto.taggedHash('TapLeaf', Buffer.concat([ Buffer.from([ 0xc0, script.length ]), script ]));
}

export function tapBranch(branch1: Buffer, branch2: Buffer): Buffer {
	return bitcoin.crypto.taggedHash(
		'TapBranch',
		Buffer.concat(branch1 < branch2 ? [ branch1, branch2 ] : [ branch2, branch1 ])
	);
}

export function tapTweak(pubkey: Buffer, branch?: Buffer): Buffer {
	return bitcoin.crypto.taggedHash('TapTweak', branch ? Buffer.concat([ pubkey.slice(-32), branch ]) : pubkey.slice(-32));
}

export function createTaprootOutput(publicKey: Buffer, tweak: Buffer): { parity: 0 | 1; key: Buffer } {
	const tweaked = curve.pointAddScalar(publicKey, tweak);
	return { parity: (tweaked[0] & 1) as 0 | 1, key: Buffer.from(tweaked).slice(-32) };
}

export function setChain(c: Chain): void {
	chain = c;
	network = networks[chain];
}

// Utils

// remove a transaction from a templateFile
// removes all dependendencies
// subtracts fee of removed transactions from coinbasevalue
// returns all removed transactions
export function removeTransaction(template: BlockTemplate, txid: string): BlockTemplateTX[] {
	const txs = template.transactions;
	const tx = txs.find(x => x.txid == txid);
	if (!tx) {
		return [];
	}
	const toRemove = [ tx ];
	const removed: BlockTemplateTX[] = [];

	while (toRemove.length) {
		const tx = toRemove.shift();
		toRemove.push(...tx.TXdepends);
		removed.push(...txs.splice(txs.indexOf(tx), 1));
	}

	template.coinbasevalue -= removed.reduce((v, x) => v + x.fee, 0);

	updateNumberDepends(template);

	return removed;
}

export async function insertTransaction(template: BlockTemplate, data: string | Buffer): Promise<boolean> {
	const rawtx = await decodeRawTransaction(data);

	if (template.transactions.find(x => x.txid == rawtx.txid)) {
		return false;
	}

	const tx: BlockTemplateTX = {
		data: Buffer.isBuffer(data) ? data.toString('hex') : data,
		txid: rawtx.txid,
		hash: rawtx.hash,
		depends: [],
		TXdepends: template.transactions.filter(x => rawtx.vin.map(y => y.txid).includes(x.txid)),
		weight: rawtx.weight
	};

	template.transactions.push(tx);

	updateNumberDepends(template);

	return true;
}

function updateTXDepends(template: BlockTemplate): void {
	for (const tx of template.transactions) {
		tx.TXdepends = tx.depends.map(i => template.transactions[i - 1]);
	}
}

function updateNumberDepends(template: BlockTemplate): void {
	for (const tx of template.transactions) {
		tx.depends = tx.TXdepends.map(tx => template.transactions.indexOf(tx) + 1);
	}
}

export function bech32toScriptPubKey(a: string): Buffer {
	const z = bitcoin.address.fromBech32(a);
	return bitcoin.script.compile([ bitcoin.script.number.encode(z.version), bitcoin.address.fromBech32(a).data ]);
}

export function cloneBuf(buf: Buffer): Buffer {
	return Uint8Array.prototype.slice.call(buf);
}

export function txidToString(txid: string | Buffer): string {
	if (typeof txid === 'string') {
		return txid;
	}
	return cloneBuf(txid).reverse().toString('hex');
}

export function toSat(BTC: number): number {
	// prevent floating point quirks: 4.24524546 * 1e8 = 424524545.99999994
	return Math.round(BTC * 1e8);
}

export function toBTC(sat: number): number {
	// prevent floating point quirks: 424524546 * 1e-8 = 4.2452454600000005
	return parseFloat((sat * 1e-8).toFixed(8));
}

export enum InputVisibility {
	Visible,
	Asterisks,
	Invisible
}

export function input(q: string, visibility: InputVisibility = InputVisibility.Visible): Promise<string> {
	var active = false;

	const rl = createInterface({
		input: process.stdin,
		output: new Writable({
			write: (chunk, encoding, cb) => {
				const c = Buffer.from(chunk, encoding);

				if (active && visibility != InputVisibility.Visible) {
					if (c.toString() == '\r\n' || c.toString() == '\n') {
						console.log();
						return cb();
					}
				}

				if (!active || visibility == InputVisibility.Visible) {
					process.stdout.write(c);
				} else if (visibility == InputVisibility.Asterisks) {
					process.stdout.write('*'.repeat(c.length));
				}

				cb();
			}
		}),
		terminal: true
	});

	const ret = new Promise<string>(r =>
		rl.question(q, a => {
			r(a);
			rl.close();
		})
	);

	active = true;

	return ret;
}

export async function sleep(ms: number): Promise<void> {
	return new Promise(r => setTimeout(r, ms));
}

// from https://stackoverflow.com/a/47296370/13800918, edited
export const consoleTrace = Object.fromEntries(
	[ 'log', 'warn', 'error' ].map(methodName => {
		return [
			methodName,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(...args: any[]) => {
				let initiator = 'unknown place';
				try {
					throw new Error();
				} catch (e) {
					if (typeof e.stack === 'string') {
						let isFirst = true;
						for (const line of e.stack.split('\n')) {
							const matches = line.match(/^\s+at\s+(.*)/);
							if (matches) {
								if (!isFirst) {
									initiator = matches[1];
									break;
								}
								isFirst = false;
							}
						}
					}
				}
				console[methodName](...args, '\n', `	at ${initiator}`);
			}
		];
	})
);
