import { spawn } from 'child_process';
import * as bitcoin from 'bitcoinjs-lib';

export interface UTXO {
	txid: string,
	vout: number,
	address: string,
	scriptPubKey: string,
	amount: number,
	confirmations: number,
	redeemScript?: string,
	witnessScript?: string,
	spendable: boolean,
	solvable: boolean,
	reused?: boolean,
	desc?: string,
	safe: boolean
}

export interface TemplateRequest {
	mode?: string,
	capabilities?: string[],
	rules: string[]
}

export interface BlockTemplateTX {
	data: string,
	txid: string,
	hash: string,
	depends: number[],
	fee?: number,
	sigops?: number,
	weight: number
}

export interface BlockTemplate {
	capabilities: string[],
  version: number,
  rules: string[],
  vbavailable: { [rulename: string]: number },
  vbrequired: number,
  previousblockhash: string,
	transactions: BlockTemplateTX[],
	coinbaseaux: { [key: string]: number },
  coinbasevalue: number,
  longpollid: string,
  target: string,
  mintime: number,
  mutable: string[],
  noncerange: string,
  sigoplimit: number,
  sizelimit: number,
  weightlimit: number,
  curtime: number,
  bits: string,
  height: number,
  default_witness_commitment: string
}

export type ScriptType =
	'nonstandard' | 'pubkey' | 'pubkeyhash' | 'scripthash' | 'multisig' |
	'nulldata' | 'witness_v0_scripthash' | 'witness_v0_keyhash' |
	'witness_v1_taproot' | 'witness_unknown'

export interface ScriptPubKey {
	asm: string,
	hex: string,
	reqSigs?: number,
	type: ScriptType,
	address?: string,
	addresses?: string[]
}

export interface Vin {
	txid: string,
	vout: number,
	scriptSig: {
		asm: string,
		hex: string
	},
	txinwitness?: string[],
	sequence: number
}

export interface Vout {
	value: number,
	n: number,
	scriptPubKey: ScriptPubKey
}

export interface RawTransaction {
	txid: string,
	hash: string,
	size: number,
	vsize: number,
	weight: number,
	version: number,
	locktime: number,
	vin: Vin[],
	vout: Vout[]
}

export interface TXOut {
	bestblock: string,
	confirmations: number,
	value: number,
	scriptPubKey: ScriptPubKey,
	coinbase: boolean
}

export type Chain = 'main' | 'test' | 'regtest' | 'signet';

var chain: Chain = 'test';

export async function btc(...args: (string | Buffer | number | {})[]): Promise<string> {
	return new Promise((r, e) => {
		const cmdargs = [ `-chain=${chain}`, '-stdin' ];
		while (
			args.length &&
			typeof args[0] === 'string' &&
			args[0].startsWith('-')
		) {
			cmdargs.push(args.shift() as string);
		}

		const p = spawn('bitcoin-cli', cmdargs);

		var out = '';

		p.stdout.setEncoding('utf8');
		p.stdout.on('data', data => out += data.toString());

		p.stderr.setEncoding('utf8');
		p.stderr.on('data', data => out += data.toString());

		p.on('close', code => {
			while (out.endsWith('\n')) {
				out = out.slice(0, -1);
			}
			(code ? e : r)(out);
		});

		p.stdin.write(args.map(x => {
			var arg: string
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
		}).join('\n'));
		p.stdin.end();
	});
}

// sign, create and send new transaction
export async function newtx(inputs: {}, outputs: {}, sat: boolean): Promise<string> {
	if (sat) {
		Object.keys(outputs).forEach(k => {
			outputs[k] = parseFloat((outputs[k] * 1e-8).toFixed(8));
		});
	}
	const tx = await btc('createrawtransaction', inputs, outputs);
	const signed = JSON.parse(await btc('signrawtransactionwithwallet', tx)).hex;
	return send(signed);
}

export async function send(hex: string): Promise<string> {
	return btc('sendrawtransaction', hex);
}

export async function listunspent(minamount: number, minconf: number, sat: boolean): Promise<UTXO[]> {
	return JSON.parse(await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`)).map((u: UTXO) => {
		if (sat) {
			u.amount = Math.round(u.amount * 1e8);
		}
		return u;
	});
}

export async function getnewaddress(): Promise<string> {
	return btc('getnewaddress');
}

export function bech32toScriptPubKey(a: string): Buffer {
	const z = bitcoin.address.fromBech32(a);
	return bitcoin.script.compile([
		bitcoin.script.number.encode(z.version),
		bitcoin.address.fromBech32(a).data
	]);
}

export async function getBlockTemplate(template_request: TemplateRequest = { rules: [ 'segwit' ] }): Promise<BlockTemplate> {
	return JSON.parse(await btc('getblocktemplate', template_request));
}

export async function decodeRawTransaction(txHex: string | Buffer): Promise<RawTransaction> {
	return JSON.parse(await btc('decoderawtransaction', txHex));
}

export async function getTXOut(txid: string | Buffer, vout: number, include_mempool: boolean = true): Promise<TXOut | undefined> {
	const txout = await btc('gettxout', txidToString(txid), vout, include_mempool);
	if (txout) {
		return JSON.parse(txout);
	}
}

export function txidToString(txid: string | Buffer): string {
	if (typeof txid === 'string') {
		return txid;
	}
	return Uint8Array.prototype.slice.call(txid).reverse().toString('hex');
}

export function toSat(BTC: number): number {
	// prevent floating point quirks: 4.24524546 * 1e8 = 424524545.99999994
	return Math.round(BTC * 1e8);
}

export function toBTC(sat: number): number {
	// prevent floating point quirks: 424524546 * 1e-8 = 4.2452454600000005
	return parseFloat((sat * 1e-8).toFixed(8));
}

export function setChain(c: Chain): void {
	chain = c;
}
