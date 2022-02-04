interface UTXO {
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

export function btc(...args: any[]): Promise<string>;

export function newtx(inputs: {}, outputs: {}, sat: boolean): Promise<string>;

export function send(hex: string): Promise<string>;

export function listunspent(minamount: number, minconf: number, sat: boolean): Promise<UTXO[]>;

export function getnewaddress(): Promise<string>;

export function bech32toScriptPubKey(a: string): Buffer;

export function setChain(c: 'main' | 'test' | 'regtest' | 'signet'): void;
