const opcodes = {
	// https://github.com/bitcoin/bitcoin/blob/fa5c896724bb359b4b9a3f89580272bfe5980c1b/src/script/script.h#L65-L206

	// push value
	OP_0: 0x00,
	OP_FALSE: 0x00,
	OP_PUSHDATA1: 0x4c,
	OP_PUSHDATA2: 0x4d,
	OP_PUSHDATA4: 0x4e,
	OP_1NEGATE: 0x4f,
	OP_RESERVED: 0x50,
	OP_1: 0x51,
	OP_TRUE: 0x51,
	OP_2: 0x52,
	OP_3: 0x53,
	OP_4: 0x54,
	OP_5: 0x55,
	OP_6: 0x56,
	OP_7: 0x57,
	OP_8: 0x58,
	OP_9: 0x59,
	OP_10: 0x5a,
	OP_11: 0x5b,
	OP_12: 0x5c,
	OP_13: 0x5d,
	OP_14: 0x5e,
	OP_15: 0x5f,
	OP_16: 0x60,

	// control
	OP_NOP: 0x61,
	OP_VER: 0x62,
	OP_IF: 0x63,
	OP_NOTIF: 0x64,
	OP_VERIF: 0x65,
	OP_VERNOTIF: 0x66,
	OP_ELSE: 0x67,
	OP_ENDIF: 0x68,
	OP_VERIFY: 0x69,
	OP_RETURN: 0x6a,

	// stack ops
	OP_TOALTSTACK: 0x6b,
	OP_FROMALTSTACK: 0x6c,
	OP_2DROP: 0x6d,
	OP_2DUP: 0x6e,
	OP_3DUP: 0x6f,
	OP_2OVER: 0x70,
	OP_2ROT: 0x71,
	OP_2SWAP: 0x72,
	OP_IFDUP: 0x73,
	OP_DEPTH: 0x74,
	OP_DROP: 0x75,
	OP_DUP: 0x76,
	OP_NIP: 0x77,
	OP_OVER: 0x78,
	OP_PICK: 0x79,
	OP_ROLL: 0x7a,
	OP_ROT: 0x7b,
	OP_SWAP: 0x7c,
	OP_TUCK: 0x7d,

	// splice ops
	OP_CAT: 0x7e,
	OP_SUBSTR: 0x7f,
	OP_LEFT: 0x80,
	OP_RIGHT: 0x81,
	OP_SIZE: 0x82,

	// bit logic
	OP_INVERT: 0x83,
	OP_AND: 0x84,
	OP_OR: 0x85,
	OP_XOR: 0x86,
	OP_EQUAL: 0x87,
	OP_EQUALVERIFY: 0x88,
	OP_RESERVED1: 0x89,
	OP_RESERVED2: 0x8a,

	// numeric
	OP_1ADD: 0x8b,
	OP_1SUB: 0x8c,
	OP_2MUL: 0x8d,
	OP_2DIV: 0x8e,
	OP_NEGATE: 0x8f,
	OP_ABS: 0x90,
	OP_NOT: 0x91,
	OP_0NOTEQUAL: 0x92,

	OP_ADD: 0x93,
	OP_SUB: 0x94,
	OP_MUL: 0x95,
	OP_DIV: 0x96,
	OP_MOD: 0x97,
	OP_LSHIFT: 0x98,
	OP_RSHIFT: 0x99,

	OP_BOOLAND: 0x9a,
	OP_BOOLOR: 0x9b,
	OP_NUMEQUAL: 0x9c,
	OP_NUMEQUALVERIFY: 0x9d,
	OP_NUMNOTEQUAL: 0x9e,
	OP_LESSTHAN: 0x9f,
	OP_GREATERTHAN: 0xa0,
	OP_LESSTHANOREQUAL: 0xa1,
	OP_GREATERTHANOREQUAL: 0xa2,
	OP_MIN: 0xa3,
	OP_MAX: 0xa4,

	OP_WITHIN: 0xa5,

	// crypto
	OP_RIPEMD160: 0xa6,
	OP_SHA1: 0xa7,
	OP_SHA256: 0xa8,
	OP_HASH160: 0xa9,
	OP_HASH256: 0xaa,
	OP_CODESEPARATOR: 0xab,
	OP_CHECKSIG: 0xac,
	OP_CHECKSIGVERIFY: 0xad,
	OP_CHECKMULTISIG: 0xae,
	OP_CHECKMULTISIGVERIFY: 0xaf,

	// expansion
	OP_NOP1: 0xb0,
	OP_CHECKLOCKTIMEVERIFY: 0xb1,
	OP_NOP2: 0xb1,
	OP_CHECKSEQUENCEVERIFY: 0xb2,
	OP_NOP3: 0xb2,
	OP_NOP4: 0xb3,
	OP_NOP5: 0xb4,
	OP_NOP6: 0xb5,
	OP_NOP7: 0xb6,
	OP_NOP8: 0xb7,
	OP_NOP9: 0xb8,
	OP_NOP10: 0xb9,

	// Opcode added by BIP 342 (Tapscript)
	OP_CHECKSIGADD: 0xba,

	OP_INVALIDOPCODE: 0xff,

	// aliases
	OP_CLTV: 0xb1,
	OP_CSV: 0xb2
};

// TODO remove
/** Opcodes that can be expanded to multiple other opcodes */
const compoundOpcodes: { [op: number]: number[] } = {
	[opcodes.OP_EQUALVERIFY]: [
		opcodes.OP_EQUAL,
		opcodes.OP_VERIFY
	],
	[opcodes.OP_NUMEQUALVERIFY]: [
		opcodes.OP_NUMEQUAL,
		opcodes.OP_VERIFY
	],
	[opcodes.OP_CHECKSIGVERIFY]: [
		opcodes.OP_CHECKSIG,
		opcodes.OP_VERIFY
	],
	[opcodes.OP_CHECKMULTISIGVERIFY]: [
		opcodes.OP_CHECKMULTISIG,
		opcodes.OP_VERIFY
	],
	[opcodes.OP_CHECKSIGADD]: [
		opcodes.OP_ROT,
		opcodes.OP_SWAP,
		opcodes.OP_CHECKSIG,
		opcodes.OP_ADD
	]
};

/*
const rules = {
	legacy: {
		// script.size() > 10000  ==> error
	},
	witnessscript: {
		// script.size() > 10000  ==> error
		// minimal if (policy)
	},
	tapscript: {
		// minimal if
		// csa, but no OP_CHECKMULTISIG
	}
};
*/

// stack.size() + altstack.size() > 1000 after each opcode execution, error

function id(e: string): HTMLElement {
	return document.getElementById(e);
}

function bufferToHex(b: Uint8Array): string {
	var hex = '';
	for (const n of b) {
		hex += n.toString(16).padStart(2, '0');
	}
	return hex;
}

function hexToBuffer(s: string): Uint8Array {
	return new Uint8Array(s.match(/../g)?.map(x => parseInt(x, 16)));
}

function getopcode(op: number): string | void {
	const o = Object.entries(opcodes).find(x => x[1] === op);
	if (o) {
		return o[0];
	}
}

function intEncodeHex(n: number, len: number): string {
	return n.toString(16).padStart(len * 2, '0').match(/../g).reverse().join('');
}

function intDecode(buf: Uint8Array): number {
	return parseInt(bufferToHex(buf.slice().reverse()), 16);
}

function scriptIntEncode(n: number): Uint8Array {
	const buf: number[] = [];
	const neg = n < 0;
	var abs = Math.abs(n);
	while (abs) {
		buf.push(abs & 0xff);
		abs >>= 8;
	}
	if (buf[buf.length - 1] & 0x80) {
		buf.push(neg ? 0x80 : 0x00);
	} else if (neg) {
		buf[buf.length - 1] |= 0x80;
	}

	return new Uint8Array(buf);
}

function scriptIntEncodeHex(n: number): string {
	return bufferToHex(scriptIntEncode(n));
}

function scriptIntDecode(buf: Uint8Array): number {
  if (!buf.length) {
    return 0;
	}

	const neg = buf[buf.length - 1] & 0x80;
	if (neg) {
		// clone before editing
		buf = buf.slice();
		buf[buf.length - 1] &= 0x7f;
	}

  var n = 0;
  for (var i = 0; i != buf.length; ++i) {
		n |= buf[i] << (i * 8);
	}

	return neg ? -n : n;
}

function scriptBoolEncode(b: boolean): Uint8Array {
	return new Uint8Array(b ? [ 1 ] : []);
}

function scriptBoolDecode(buf: Uint8Array): boolean {
	for (var i = 0; i < buf.length; i++) {
		if (buf[i] !== 0) {
			return i !== buf.length - 1 || buf[i] !== 0x80;
		}
	}
	return false;
}

const html = {
	asm: <HTMLInputElement>id('asm'),
	asmError: id('asm-error'),
	hex: <HTMLInputElement>id('hex'),
	hexError: id('hex-error'),
	analysis: id('analysis')
};

[ html.asm, html.hex ].forEach(el => el.addEventListener('keydown', function(e) {
	if (e.key === 'Tab') {
		e.preventDefault();
		const start = this.selectionStart;
		const end = this.selectionEnd;
		const val = this.value;

		this.value = val.substring(0, start) + '\t' + val.substring(end);

		this.selectionStart = start + 1;
		this.selectionEnd = start + 1;
	}
}));

[ 'keydown', 'keypress', 'keyup' ].forEach(a => {
	html.asm.addEventListener(a, () => {
		html.asmError.innerText = asmtohex();
	});
	html.hex.addEventListener(a, () => {
		html.hexError.innerText = hextoasm();
	});
});

function asmtohex(): string {
	const src = html.asm.value.split(/[ \t\n]+/).filter(x => x);
	var script = '';
	for (const op of src) {
		if (/^(|-)[0-9]+$/.test(op)) {
			const n = parseInt(op);
			if (n === 0) {
				// OP_0
				script += '00';
			} else if (n >= -1 && n <= 16) {
				// OP_1NEGATE (4f), OP_1 (51) ... OP_16 (60)
				script += (0x50 + n).toString(16);
			} else {
				if (Math.abs(n) > 0x7fffffff) {
					return 'Too large decimal integer';
				}
				const s = scriptIntEncode(n);
				script += intEncodeHex(s.length, 1) + bufferToHex(s);
			}
		} else if (/^<[0-9a-fA-F]*>$/.test(op)) {
			var hex = op.slice(1, -1).toLowerCase();
			if (hex.length & 1) {
				return 'Odd amount of characters in hex literal'
			}
			const l = hex.length / 2;
			if (l <= 75) {
				script += intEncodeHex(l, 1);
			} else if (l <= 0xff) {
				// OP_PUSHDATA1
				script += '4c' + intEncodeHex(l, 1);
			} else if (l <= 520) {
				// OP_PUSHDATA2
				script += '4d' + intEncodeHex(l, 2);
			} else {
				return 'Data push too large';
			}
			script += hex;
		} else {
			const opcode: number = opcodes[op.toUpperCase()] || opcodes['OP_' + op.toUpperCase()];
			if (opcode === undefined) {
				return 'Unknown opcode ' + op + (/^[0-9a-fA-F]+$/.test(op) ? '. If you tried to push hex data, encapsulate it with < and >' : '');
			}
			if (/PUSHDATA(1|2|4)$/.test(op.toUpperCase())) {
				return 'OP_PUSHDATA is not allowed is Bitcoin ASM script'
			}
			script += intEncodeHex(opcode, 1);
		}
	}
	html.hex.value = script;
	html.hexError.innerText = '';
	return '';
}

function hextoasm(): string {
	const v = html.hex.value.replace(/[ \t\n]+/g,'').toLowerCase();
	if (!/^[0-9a-f]*$/.test(v)) {
		return 'Illegal characters in hex literal';
	}
	if (v.length % 2) {
		return 'Odd amount of characters in hex literal';
	}
	const bytes = hexToBuffer(v);
	const script: string[] = [];
	const a: Script = [];
	for (var offset = 0; offset < bytes.length;) {
		const b = bytes[offset++];
		const op = getopcode(b);
		if (op) {
			if (op.startsWith('OP_PUSHDATA')) {
				const n = parseInt(op.match(/1|2|4/)[0]);
				const l = intDecode(bytes.subarray(offset, offset + n));
				offset += n;
				if (l > 520) {
					return 'Data push too large';
				}
				const data = bytes.subarray(offset, offset + l);
				offset += l;
				if (data.length != l) {
					return 'Invalid length, expected ' + l + ' but got ' + data.length;
				}
				script.push('<' + bufferToHex(data) + '>');
				a.push(data);
			} else {
				if (b === 0) {
					script.push('0');
					a.push(new Uint8Array());
				} else if (b >= opcodes.OP_1 && b <= opcodes.OP_16 || b === opcodes.OP_1NEGATE) {
					script.push('' + (b - 0x50));
					a.push(new Uint8Array([ b - 0x50 ]));
				} else {
					script.push(op);
					a.push(b);
				}
			}
		} else if (b <= 75) {
			const data = bytes.subarray(offset, offset + b);
			offset += b;
			if (data.length != b) {
				return 'Invalid length, expected ' + b + ' but got ' + data.length;
			}
			if (b <= 4) {
				script.push('' + scriptIntDecode(data));
			} else {
				script.push('<' + bufferToHex(data) + '>');
			}
			a.push(data);
		} else {
			return 'Invalid opcode 0x' + b.toString(16).padStart(2, '0');
		}
	}
	new ScriptAnalyzer(a).debug();
	html.asm.value = script.join('\n');
	html.asmError.innerText = '';
	return '';
}

type Expr = { opcode: number, args: Stack } | { var: number };
type Stack = (Uint8Array | Expr)[];
type Script = (Uint8Array | number)[];

// pass a script to the constructor that only uses numbers for non pushing opcodes
// OP_0 needs to be converted to <>, OP_1 needs to be converted to <01>, and so on
class ScriptAnalyzer {
	private stack: Stack;
	private altstack: Stack;
	private spendingConditions: Expr[];
	private varCounter: number;

	constructor(script: Script) {
		// for now
		this.analyzePath(script);
	}

	debug(): void {
		console.log(this.spendingConditions.map(s => this.exprToString(s)).join(' && '));
		console.log(this.stack);
	}

	private exprToString(e: Expr): string {
		if ('opcode' in e) {
			return `${(getopcode(e.opcode) || 'UNKNOWN').replace(/^OP_/, '')}(${e.args.map(a => (a instanceof Uint8Array) ? `<${bufferToHex(a)}>` : this.exprToString(a))})`;
		} else {
			return `<input${e.var}>`;
		}
	}

	private analyzePath(script: Script) {
		this.spendingConditions = [];
		this.stack = [];
		this.altstack = [];
		this.varCounter = 0;

		for (const op of [ ...this.expandScript(script), opcodes.OP_VERIFY ]) {
			if (op instanceof Uint8Array) {
				this.stack.push(op);
			} else {
				switch (op) {
					case opcodes.OP_RESERVED: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NOP: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_VER: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_IF: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NOTIF: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_VERIF: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_VERNOTIF: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_ELSE: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_ENDIF: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_VERIFY: {
						const elem = this.takeElement();
						if (elem instanceof Uint8Array) {
							if (!scriptBoolDecode(elem)) {
								return 'op verify';
							}
						} else {
							this.spendingConditions.push(elem);
						}
						break;
					}
					case opcodes.OP_RETURN: {
						return 'op return';
					}
					case opcodes.OP_TOALTSTACK: {
						this.altstack.push(this.takeElement());
						break;
					}
					case opcodes.OP_FROMALTSTACK: {
						if (!this.altstack.length) {
							return 'no altstack elements';
						}
						this.stack.push(this.altstack.pop());
						break;
					}
					case opcodes.OP_2DROP: {
						this.takeElements(2);
						break;
					}
					case opcodes.OP_2DUP: {
						this.stack.push(...this.readElements(2));
						break;
					}
					case opcodes.OP_3DUP: {
						this.stack.push(...this.readElements(3));
						break;
					}
					case opcodes.OP_2OVER: {
						this.stack.push(...this.readElements(4).slice(0, 2));
						break;
					}
					case opcodes.OP_2ROT: {
						const elems = this.takeElements(6);
						this.stack.push(...elems.slice(2), ...elems.slice(0, 2));
						break;
					}
					case opcodes.OP_2SWAP: {
						const elems = this.takeElements(4);
						this.stack.push(...elems.slice(2), ...elems.slice(0, 2));
						break;
					}
					case opcodes.OP_IFDUP: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_DEPTH: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_DROP: {
						this.takeElement();
						break;
					}
					case opcodes.OP_DUP: {
						this.stack.push(this.readElement());
						break;
					}
					case opcodes.OP_NIP: {
						this.stack.push(this.takeElements(2)[1]);
						break;
					}
					case opcodes.OP_OVER: {
						this.stack.push(this.readElements(2)[0]);
						break;
					}
					case opcodes.OP_PICK:
					case opcodes.OP_ROLL: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_ROT: {
						const elems = this.takeElements(3);
						this.stack.push(...elems.slice(1), elems[0]);
						break;
					}
					case opcodes.OP_SWAP: {
						const elems = this.takeElements(2);
						this.stack.push(elems[1], elems[0]);
						break;
					}
					case opcodes.OP_TUCK: {
						const elems = this.takeElements(2);
						this.stack.push(elems[1], ...elems);
						break;
					}
					case opcodes.OP_CAT:
					case opcodes.OP_SUBSTR:
					case opcodes.OP_LEFT:
					case opcodes.OP_RIGHT: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_SIZE: {
						throw 'not implemented';
					}
					case opcodes.OP_INVERT:
					case opcodes.OP_AND:
					case opcodes.OP_OR:
					case opcodes.OP_XOR: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_EQUAL: {
						this.stack.push({ opcode: op, args: this.takeElements(2) });
						break;
					}
					case opcodes.OP_EQUALVERIFY: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_RESERVED1:
					case opcodes.OP_RESERVED2: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_1ADD: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_1SUB: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_2MUL:
					case opcodes.OP_2DIV: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NEGATE: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_ABS: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NOT: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_0NOTEQUAL: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_ADD: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_SUB: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_MUL:
					case opcodes.OP_DIV:
					case opcodes.OP_MOD:
					case opcodes.OP_LSHIFT:
					case opcodes.OP_RSHIFT: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_BOOLAND: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_BOOLOR: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NUMEQUAL: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NUMEQUALVERIFY: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NUMNOTEQUAL: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_LESSTHAN: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_GREATERTHAN: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_LESSTHANOREQUAL: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_GREATERTHANOREQUAL: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_MIN: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_MAX: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_WITHIN: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_RIPEMD160:
					case opcodes.OP_SHA1:
					case opcodes.OP_SHA256:
					case opcodes.OP_HASH160:
					case opcodes.OP_HASH256: {
						this.stack.push({ opcode: op, args: this.takeElements(1) });
						break;
					}
					case opcodes.OP_CODESEPARATOR: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_CHECKSIG: {
						this.stack.push({ opcode: op, args: this.takeElements(2) });
						break;
					}
					case opcodes.OP_CHECKSIGVERIFY: {
						break;
					}
					case opcodes.OP_CHECKMULTISIG: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_CHECKMULTISIGVERIFY: {
						break;
					}
					case opcodes.OP_NOP1: {
						break;
					}
					case opcodes.OP_CHECKLOCKTIMEVERIFY:
					case opcodes.OP_CHECKSEQUENCEVERIFY: {
						this.spendingConditions.push({ opcode: op, args: this.readElements(1) });
						break;
					}
					case opcodes.OP_NOP4:
					case opcodes.OP_NOP5:
					case opcodes.OP_NOP6:
					case opcodes.OP_NOP7:
					case opcodes.OP_NOP8:
					case opcodes.OP_NOP9:
					case opcodes.OP_NOP10: {
						break;
					}
					case opcodes.OP_CHECKSIGADD: {
						throw `${getopcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_INVALIDOPCODE: {
						throw 'OP_INVALIDOPCODE';
					}
					default: {
						throw 'unassigned opcode';
					}
				}
			}
		}

		if (this.stack.length) {
			return 'Stack size must be exactly one after execution';
		}
	}

	private expandScript(script: Script): Script {
		const expanded: Script = [];
		for (const elem of script) {
			if (typeof elem === 'number' && compoundOpcodes[elem]) {
				expanded.push(...compoundOpcodes[elem]);
			} else {
				expanded.push(elem);
			}
		}
		return expanded;
	}

	private takeElement(): Uint8Array | Expr {
		return this.takeElements(1)[0];
	}

	private takeElements(amount: number): Stack {
		const res: Stack = [];
		for (var i = 0; i < amount; i++) {
			if (this.stack.length) {
				res.push(this.stack.pop());
			} else {
				res.push({ var: this.varCounter++ });
			}
		}
		return res;
	}

	private readElement(): Uint8Array | Expr {
		return this.readElements(1)[0];
	}

	private readElements(amount: number): Stack {
		while (this.stack.length < amount) {
			this.stack.unshift({ var: this.varCounter++ });
		}
		return this.stack.slice(this.stack.length - amount);
	}

	// true if one of the lists is empty
	// true if both lists have elements and at least one overlaps
	private overlap<T>(a1: T[], a2: T[]): boolean {
		if (a1.length && a2.length) {
			for (const e of a1) {
				if (a2.includes(e)) {
					return true;
				}
			}
			return false;
		}
		return true;
	}
}
