import { spawn } from 'child_process';
import * as bitcoin from 'bitcoinjs-lib';
import * as curve from 'tiny-secp256k1';
import { createInterface } from 'readline';
import { Writable } from 'stream';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import { strict as assert } from 'assert';

export { descsumCreate } from './descriptors';

const ECPair = ECPairFactory(curve);

export namespace Uint256 {
	export function toBigint(b: Uint8Array): bigint {
		return BigInt('0x' + Buffer.from(b).toString('hex'));
	}

	export function toBuffer(n: bigint): Buffer {
		return Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
	}
}

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

export interface ListUnspentArgs {
	/** Default value: 1 */
	minconf?: number;
	/** Default value: 9999999 */
	maxconf?: number;
	/** Default value: [] */
	addresses?: string[];
	/** Default value: true */
	include_unsafe?: boolean;
	/** Default value: 0 */
	minimumAmount?: number;
	/** Default value: unlimited */
	maximumAmount?: number;
	/** Default value: unlimited */
	maximumCount?: number;
	/** Default value: unlimited */
	minimumSumAmount?: number;
}

export type TransactionType = string | Buffer | bitcoin.Transaction;

export type Chain = 'main' | 'test' | 'regtest' | 'signet';

export const networks: { [name in Chain]: bitcoin.networks.Network } = {
	main: bitcoin.networks.bitcoin,
	test: bitcoin.networks.testnet,
	regtest: bitcoin.networks.regtest,
	signet: bitcoin.networks.testnet
};

let chain: Chain = 'test';
export let network = networks[chain];

export async function btc(...args: (string | Buffer | number | {} | TransactionType)[]): Promise<string> {
	return new Promise((r, e) => {
		const cmdargs = [ `-chain=${chain}`, '-stdin' ];
		while (args.length && typeof args[0] === 'string' && args[0].startsWith('-')) {
			cmdargs.push(args.shift() as string);
		}

		const p = spawn('bitcoin-cli', cmdargs);

		let out = '';

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
					let arg: string;
					if (Buffer.isBuffer(x)) {
						arg = x.toString('hex');
					} else if (typeof x === 'number') {
						arg = x.toString();
					} else if (typeof x === 'string') {
						arg = x;
					} else if (x instanceof bitcoin.Transaction) {
						arg = x.toHex();
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
	outputs: RawTransactionOutput | RawTransactionOutput[],
	sat: boolean
): Promise<string> {
	if (sat) {
		if (Array.isArray(outputs)) {
			for (const outs of outputs) {
				Object.keys(outs).forEach(k => {
					if (k !== 'data') {
						outs[k] = toBTC(outs[k]);
					}
				});
			}
		} else {
			Object.keys(outputs).forEach(k => {
				if (k !== 'data') {
					outputs[k] = toBTC(outputs[k]);
				}
			});
		}
	}
	const tx = await btc('createrawtransaction', inputs, outputs);
	return signAndSend(tx);
}

export async function signAndSend(tx: TransactionType): Promise<string> {
	return send(JSON.parse(await btc('signrawtransactionwithwallet', tx)).hex);
}

export async function fundTransaction(
	tx: TransactionType
): Promise<{ tx: bitcoin.Transaction; fee: number; changepos: number }> {
	const res = JSON.parse(await btc('fundrawtransaction', tx));

	res.tx = bitcoin.Transaction.fromHex(res.hex);
	delete res.hex;

	return res;
}

export async function send(tx: TransactionType): Promise<string> {
	return btc('sendrawtransaction', tx);
}

/** @deprecated Use listUnspent instead */
export async function listunspent(minamount: number, minconf: number, sat: boolean): Promise<UTXO[]> {
	return JSON.parse(
		await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`)
	).map((u: UTXO) => {
		if (sat) {
			u.amount = toSat(u.amount);
		}
		return u;
	});
}

/** Lists unspent transaction outputs (UTXOs) */
export async function listUnspent(args: ListUnspentArgs = {}, sats = true): Promise<UTXO[]> {
	const minconf = args.minconf === undefined ? 1 : args.minconf;
	const maxconf = args.maxconf === undefined ? 9999999 : args.maxconf;
	const addresses = args.addresses || [];
	const include_unsafe = args.include_unsafe === undefined ? true : args.include_unsafe;
	const query_options = {};
	for (const k in args) {
		if ([ 'minimumAmount', 'maximumAmount', 'maximumCount', 'minimumSumAmount' ].includes(k)) {
			query_options[k] = sats && k.endsWith('Amount') ? toBTC(args[k]) : args[k];
		}
	}
	const utxos: UTXO[] = JSON.parse(
		await btc('listunspent', minconf, maxconf, addresses, include_unsafe, query_options)
	);
	if (sats) {
		for (let i = 0; i < utxos.length; i++) {
			utxos[i].amount = toSat(utxos[i].amount);
		}
	}
	return utxos;
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

export async function decodeRawTransaction(tx: TransactionType): Promise<RawTransaction> {
	return JSON.parse(await btc('decoderawtransaction', tx));
}

export async function getTXOut(txid: string | Buffer, vout: number, include_mempool = true): Promise<TXOut | void> {
	const txout = await btc('gettxout', txidToString(txid), vout, include_mempool);
	if (txout) {
		return JSON.parse(txout);
	}
}

export namespace testMempoolAccept {
	interface Transaction {
		txid: string;
		wtxid: string;
		allowed: boolean;
	}

	export interface AllowedTransaction extends Transaction {
		allowed: true;
		vsize: number;
		fees: { base: number };
	}

	export interface RejectedTransaction extends Transaction {
		allowed: false;
		'reject-reason': string;
	}

	export interface RejectedPackageTransaction extends RejectedTransaction {
		'package-error'?: string;
	}

	export type SingleOutput = AllowedTransaction | RejectedTransaction;
	export type PackageOutput = (AllowedTransaction | RejectedPackageTransaction)[];
	export type Output = SingleOutput | PackageOutput;
}

/** note: maxfeerate is in sat/vB */
export async function testMempoolAccept(tx: TransactionType, maxfee?: number): Promise<testMempoolAccept.SingleOutput>;
export async function testMempoolAccept(
	txs: TransactionType[],
	maxfee?: number
): Promise<testMempoolAccept.PackageOutput>;
export async function testMempoolAccept(
	txs: TransactionType | TransactionType[],
	maxfeerate?: number
): Promise<testMempoolAccept.Output> {
	const arr = Array.isArray(txs);
	const res = JSON.parse(
		await (maxfeerate === undefined
			? btc('testmempoolaccept', arr ? txs : [ txs ])
			: btc('testmempoolaccept', arr ? txs : [ txs ], toBTCkvB(maxfeerate)))
	);
	return arr ? res : res[0];
}

export namespace getChainTips {
	interface ChainTip {
		height: number;
		hash: string;
	}

	export interface ActiveChainTip extends ChainTip {
		branchlen: 0;
		status: 'active';
	}

	export interface InactiveChainTip extends ChainTip {
		branchlen: number;
		status: 'invalid' | 'headers-only' | 'valid-headers' | 'valid-fork' | 'unknown';
	}

	// export type Output = [ ActiveChainTip, ...InactiveChainTip[] ];
	export type Output = (ActiveChainTip | InactiveChainTip)[];
}

export async function getChainTips(): Promise<getChainTips.Output> {
	return JSON.parse(await btc('getchaintips'));
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

const ONE = Uint256.toBuffer(1n);
const N_LESS_1 = Buffer.from(curve.privateSub(ONE, Uint256.toBuffer(2n))!);

export function negateIfOddPubkey(d: Uint8Array): Buffer {
	if (curve.pointFromScalar(d, true)[0] == 3) {
		return Buffer.from(curve.privateAdd(curve.privateSub(N_LESS_1, d), ONE));
	}
	return Buffer.from(d);
}

const EC_N = Uint256.toBigint(N_LESS_1) + 1n;

export function ecPrivateMul(a: Uint8Array, b: Uint8Array): Buffer {
	const an = Uint256.toBigint(a);
	const bn = Uint256.toBigint(b);
	if (an <= 0n || an >= EC_N) {
		throw new Error('a out of range');
	}
	if (bn <= 0n || bn >= EC_N) {
		throw new Error('b out of range');
	}
	return Uint256.toBuffer((an * bn) % EC_N);
}

export function tapLeaf(script: Buffer): Buffer {
	return bitcoin.crypto.taggedHash(
		'TapLeaf',
		Buffer.concat([ Buffer.from([ 0xc0 ]), encodeVarUintLE(script.length), script ])
	);
}

export function tapBranch(branch1: Buffer, branch2: Buffer): Buffer {
	return bitcoin.crypto.taggedHash(
		'TapBranch',
		Buffer.concat(branch1 < branch2 ? [ branch1, branch2 ] : [ branch2, branch1 ])
	);
}

export function tapTweak(pubkey: Buffer, root?: Buffer): Buffer {
	return bitcoin.crypto.taggedHash('TapTweak', root ? Buffer.concat([ pubkey.slice(-32), root ]) : pubkey.slice(-32));
}

export function bip86(ecpair: ECPairInterface): ECPairInterface {
	const tweak = tapTweak(ecpair.publicKey);
	const opts = {
		compressed: ecpair.compressed,
		network: ecpair.network
	};
	if (ecpair.privateKey) {
		return ECPair.fromPrivateKey(Buffer.from(curve.privateAdd(ecpair.privateKey, tweak)), opts);
	}
	return ECPair.fromPublicKey(Buffer.from(curve.pointAddScalar(ecpair.publicKey, tweak)), opts);
}

export function createTaprootOutput(
	pubkey: Buffer,
	root?: Buffer
): { key: Buffer; parity: 0 | 1; scriptPubKey: Buffer; address: string } {
	const tweaked = curve.pointAddScalar(pubkey, tapTweak(pubkey, root));
	const key = Buffer.from(tweaked).slice(-32);
	return {
		key,
		parity: (tweaked[0] & 1) as 0 | 1,
		scriptPubKey: bitcoin.script.compile([ bitcoin.opcodes.OP_1, key ]),
		address: bitcoin.address.toBech32(key, 1, network.bech32)
	};
}

export function setChain(c: Chain): void {
	chain = c;
	network = networks[chain];
}

// Utils

export function encodeVarUintLE(n: bigint | number): Buffer {
	if (typeof n === 'number') {
		assert(n >= 0 && n <= Number.MAX_SAFE_INTEGER && n % 1 === 0);
		n = BigInt(n);
	} else {
		assert(n >= 0n && n <= 0xffffffffffffffffn);
	}
	if (n > 0xffffffffn) {
		const buf = Buffer.allocUnsafe(9);
		buf.writeUint8(0xff);
		buf.writeBigUint64LE(n, 1);
		return buf;
	} else if (n > 0xffffn) {
		const buf = Buffer.allocUnsafe(5);
		buf.writeUint8(0xfe);
		buf.writeUint32LE(Number(n), 1);
		return buf;
	} else if (n > 0xfcn) {
		const buf = Buffer.allocUnsafe(3);
		buf.writeUint8(0xfd);
		buf.writeUint16LE(Number(n), 1);
		return buf;
	} else {
		const buf = Buffer.allocUnsafe(1);
		buf.writeUint8(Number(n));
		return buf;
	}
}

export function decodeVarUintLE(buf: Buffer, bigint: true): bigint;
export function decodeVarUintLE(buf: Buffer, bigint: false): number;
export function decodeVarUintLE(buf: Buffer, bigint: boolean): bigint | number {
	let n: number;
	if (buf[0] === 0xff && buf.length >= 9) {
		const n = buf.readBigUint64LE(1);
		if (bigint) {
			return n;
		} else {
			assert(n <= Number.MAX_SAFE_INTEGER);
			return Number(n);
		}
	} else if (buf[0] === 0xfe && buf.length >= 5) {
		n = buf.readUint32LE(1);
	} else if (buf[0] === 0xfd && buf.length >= 3) {
		n = buf.readUint16LE(1);
	} else {
		n = buf.readUint8();
	}
	return bigint ? BigInt(n) : n;
}

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
		const tx = toRemove.shift()!;
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

export function toSat(btcAmount: number): number {
	// prevent floating point quirks: 4.24524546 * 1e8 = 424524545.99999994
	return Math.round(btcAmount * 1e8);
}

export function toBTC(satAmount: number): number {
	// prevent floating point quirks: 424524546 * 1e-8 = 4.2452454600000005
	return parseFloat((satAmount * 1e-8).toFixed(8));
}

/** Converts a fee rate in BTC/kvB to sat/vB */
export function toSatvB(btckvB: number): number {
	return toSat(btckvB) / 1000;
}

/** Converts a fee rate in sat/vB to BTC/kvB */
export function toBTCkvB(satvB: number): number {
	return toBTC(Math.round(satvB * 1000));
}

export async function input(q: string, hide = false): Promise<string> {
	let active = false;

	const rl = createInterface({
		input: process.stdin,
		output: new Writable({
			write: (chunk, encoding, cb) => {
				const c = Buffer.from(chunk, encoding);

				if (active && hide) {
					if (c.toString() == '\r\n' || c.toString() == '\n') {
						console.log();
						return cb();
					}
				} else {
					process.stdout.write(c);
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
					if (e instanceof Error && e.stack) {
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
