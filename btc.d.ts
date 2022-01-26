export function btc(...args: any[]): Promise<string>;

export function newtx(inputs: {}, outputs: {}, sat: boolean): Promise<string>;

export function send(hex: string): Promise<string>;

export function listunspent(minamount: number, minconf: number, sat: boolean): Promise<{}>;

export function getnewaddress(): Promise<string>;

export function bech32toScriptPubKey(a: string): Buffer;

export function setChain(c: 'main' | 'test' | 'regtest' | 'signet'): void;
