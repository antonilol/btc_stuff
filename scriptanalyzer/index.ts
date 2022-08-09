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

const html = {
	asm: <HTMLInputElement>document.getElementById('asm'),
	asmError: document.getElementById('asm-error'),
	hex: <HTMLInputElement>document.getElementById('hex'),
	hexError: document.getElementById('hex-error'),
	analysis: document.getElementById('analysis')
};

[ html.asm, html.hex ].forEach(el =>
	el.addEventListener('keydown', function (e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const start = this.selectionStart;
			const end = this.selectionEnd;
			const val = this.value;

			this.value = val.substring(0, start) + '\t' + val.substring(end);

			this.selectionStart = start + 1;
			this.selectionEnd = start + 1;
		}
	})
);

[ 'keydown', 'keypress', 'keyup' ].forEach(a => {
	html.asm.addEventListener(a, () => {
		html.asmError.innerText = asmtohex();
		hextoasm(true);
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
				const s = ScriptConv.Int.encode(n);
				script += Util.intEncodeLEHex(s.length, 1) + Util.bufferToHex(s);
			}
		} else if (/^<[0-9a-fA-F]*>$/.test(op)) {
			var hex = op.slice(1, -1).toLowerCase();
			if (hex.length & 1) {
				return 'Odd amount of characters in hex literal';
			}
			const l = hex.length / 2;
			if (l <= 75) {
				script += Util.intEncodeLEHex(l, 1);
			} else if (l <= 0xff) {
				// OP_PUSHDATA1
				script += '4c' + Util.intEncodeLEHex(l, 1);
			} else if (l <= 520) {
				// OP_PUSHDATA2
				script += '4d' + Util.intEncodeLEHex(l, 2);
			} else {
				return 'Data push too large';
			}
			script += hex;
		} else {
			const opcode: number = opcodes[op.toUpperCase()] || opcodes['OP_' + op.toUpperCase()];
			if (opcode === undefined) {
				return (
					'Unknown opcode ' +
					op +
					(/^[0-9a-fA-F]+$/.test(op) ? '. If you tried to push hex data, encapsulate it with < and >' : '')
				);
			}
			if (/PUSHDATA(1|2|4)$/.test(op.toUpperCase())) {
				return 'OP_PUSHDATA is not allowed is Bitcoin ASM script';
			}
			script += Util.intEncodeLEHex(opcode, 1);
		}
	}
	html.hex.value = script;
	html.hexError.innerText = '';
	return '';
}

function hextoasm(): string;
function hextoasm<T extends boolean>(analyzeOnly: T): T extends true ? void : string;
function hextoasm(analyzeOnly = false): void | string {
	const v = html.hex.value.replace(/[ \t\n]+/g, '').toLowerCase();
	if (!analyzeOnly) {
		if (!/^[0-9a-f]*$/.test(v)) {
			return 'Illegal characters in hex literal';
		}
		if (v.length % 2) {
			return 'Odd amount of characters in hex literal';
		}
	}
	const bytes = Util.hexToBuffer(v);
	const script: string[] = [];
	const a: Script = [];
	for (var offset = 0; offset < bytes.length; ) {
		const b = bytes[offset++];
		const op = getOpcode(b);
		if (op) {
			if (op.startsWith('OP_PUSHDATA')) {
				const n = parseInt(op.match(/1|2|4/)[0]);
				const l = Util.intDecodeLE(bytes.subarray(offset, offset + n));
				offset += n;
				if (l > 520) {
					return 'Data push too large';
				}
				const data = bytes.subarray(offset, offset + l);
				offset += l;
				if (!analyzeOnly) {
					if (data.length != l) {
						return 'Invalid length, expected ' + l + ' but got ' + data.length;
					}
					script.push(Util.scriptElemToHex(data));
				}
				a.push(data);
			} else {
				if (!analyzeOnly) {
					if (b === 0) {
						script.push('0');
					} else if ((b >= opcodes.OP_1 && b <= opcodes.OP_16) || b === opcodes.OP_1NEGATE) {
						script.push('' + (b - 0x50));
					} else {
						script.push(op);
					}
				}
				a.push(b);
			}
		} else if (b <= 75) {
			const data = bytes.subarray(offset, offset + b);
			offset += b;
			if (!analyzeOnly) {
				if (data.length != b) {
					return 'Invalid length, expected ' + b + ' but got ' + data.length;
				}
				if (b <= 4) {
					script.push('' + ScriptConv.Int.decode(data));
				} else {
					script.push(Util.scriptElemToHex(data));
				}
			}
			a.push(data);
		} else if (!analyzeOnly) {
			return 'Invalid opcode 0x' + b.toString(16).padStart(2, '0');
		}
	}
	ScriptAnalyzer.analyzeScript(a);
	if (analyzeOnly) {
		return;
	}
	html.asm.value = script.join('\n');
	html.asmError.innerText = '';
	return '';
}

enum ElementType {
	/** Only for minimal encoded booleans. Has 2 possible values: <> and <01> */
	Bool,
	/** Any stack element not larger than 4 bytes */
	Number
}

type Expr = ({ opcode: number; args: Stack } | { var: number }) & { type?: ElementType; len?: number[] };
type Stack = (Uint8Array | Expr)[];
type Script = (Uint8Array | number)[];

class ScriptAnalyzer {
	private stack: Stack = [];
	private altstack: Stack = [];
	private spendingConditions: Expr[] = [];
	private varCounter = 0;
	private readonly script: Script;
	private scriptOffset = 0;
	private path = 0;
	private branches: ScriptAnalyzer[] = [];

	/** Pass an array of (Uint8Array | number) where a Uint8Array is a data push and a number is an opcode */
	public static analyzeScript(script: Script): string {
		for (const op of script) {
			if (typeof op === 'number' && disabledOpcodes.includes(op)) {
				return scriptErrorString(ScriptError.SCRIPT_ERR_DISABLED_OPCODE);
			}
		}

		const analyzer = new ScriptAnalyzer(script);

		const out = analyzer.analyze();
		if (typeof out === 'number') {
			console.log('spending path error:', scriptErrorString(out), analyzer.stack);
			return;
		}

		analyzer.debug();
	}

	private constructor(analyzer: ScriptAnalyzer);
	private constructor(script: Script);
	private constructor(arg: Script | ScriptAnalyzer) {
		if (arg instanceof ScriptAnalyzer) {
			this.stack = arg.stack;
			this.altstack = arg.altstack;
			this.spendingConditions = arg.spendingConditions;
			this.varCounter = arg.varCounter;
			this.script = arg.script;
			this.scriptOffset = arg.scriptOffset;
			this.path = arg.path + 1;
		} else {
			this.script = arg;
		}
	}

	debug(): void {
		console.log(this.spendingConditions.map(s => Util.exprToString(s)).join(' && '));
		console.log('stack', this.stack);
		console.log('altstack', this.altstack);
	}

	private analyze(): void | ScriptError {
		while (this.scriptOffset < this.script.length) {
			const op = this.script[this.scriptOffset++];
			if (op instanceof Uint8Array) {
				this.stack.push(op);
			} else {
				switch (op) {
					case opcodes.OP_0: {
						this.stack.push(new Uint8Array([]));
						break;
					}
					case opcodes.OP_1:
					case opcodes.OP_2:
					case opcodes.OP_3:
					case opcodes.OP_4:
					case opcodes.OP_5:
					case opcodes.OP_6:
					case opcodes.OP_7:
					case opcodes.OP_8:
					case opcodes.OP_9:
					case opcodes.OP_10:
					case opcodes.OP_11:
					case opcodes.OP_12:
					case opcodes.OP_13:
					case opcodes.OP_14:
					case opcodes.OP_15:
					case opcodes.OP_16: {
						this.stack.push(new Uint8Array([ op - 0x50 ]));
						break;
					}
					case opcodes.OP_NOP: {
						break;
					}
					case opcodes.OP_IF: {
						throw `${getOpcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_NOTIF: {
						throw `${getOpcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_ELSE: {
						throw `${getOpcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_ENDIF: {
						throw `${getOpcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_VERIFY: {
						if (!this.verify()) {
							return ScriptError.SCRIPT_ERR_VERIFY;
						}
						break;
					}
					case opcodes.OP_RETURN: {
						return ScriptError.SCRIPT_ERR_OP_RETURN;
					}
					case opcodes.OP_TOALTSTACK: {
						this.altstack.push(this.takeElements(1)[0]);
						break;
					}
					case opcodes.OP_FROMALTSTACK: {
						if (!this.altstack.length) {
							return ScriptError.SCRIPT_ERR_INVALID_ALTSTACK_OPERATION;
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
						throw `${getOpcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_DEPTH: {
						this.stack.push(ScriptConv.Int.encode(this.stack.length));
						break;
					}
					case opcodes.OP_DROP: {
						this.takeElements(1);
						break;
					}
					case opcodes.OP_DUP: {
						this.stack.push(this.readElements(1)[0]);
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
						const top = this.takeElements(1)[0];
						if (!(top instanceof Uint8Array)) {
							throw `${getOpcode(op)} can't use stack/output values as depth (yet)`;
						}
						if (top.length > 4) {
							return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
						}
						const index = ScriptConv.Int.decode(top);
						if (index < 0) {
							return ScriptError.SCRIPT_ERR_INVALID_STACK_OPERATION;
						}
						const elem = this.readElements(index + 1)[0];
						if (op === opcodes.OP_ROLL) {
							this.stack.splice(this.stack.length - index - 1, 1);
						}
						this.stack.push(elem);
						break;
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
					case opcodes.OP_SIZE: {
						throw `${getOpcode(op)} not implemented (yet)`;
					}
					case opcodes.OP_EQUAL:
					case opcodes.OP_EQUALVERIFY: {
						this.stack.push({ opcode: opcodes.OP_EQUAL, args: this.takeElements(2) });
						if (op === opcodes.OP_EQUALVERIFY && !this.verify()) {
							return ScriptError.SCRIPT_ERR_EQUALVERIFY;
						}
						break;
					}
					case opcodes.OP_1ADD:
					case opcodes.OP_1SUB:
					case opcodes.OP_NEGATE:
					case opcodes.OP_ABS:
					case opcodes.OP_NOT:
					case opcodes.OP_0NOTEQUAL: {
						this.stack.push({ opcode: op, args: this.takeElements(1) });
						break;
					}
					case opcodes.OP_ADD:
					case opcodes.OP_SUB:
					case opcodes.OP_BOOLAND:
					case opcodes.OP_BOOLOR:
					case opcodes.OP_NUMEQUAL:
					case opcodes.OP_NUMEQUALVERIFY:
					case opcodes.OP_NUMNOTEQUAL:
					case opcodes.OP_LESSTHAN:
					case opcodes.OP_GREATERTHAN:
					case opcodes.OP_LESSTHANOREQUAL:
					case opcodes.OP_GREATERTHANOREQUAL:
					case opcodes.OP_MIN:
					case opcodes.OP_MAX: {
						this.stack.push({
							opcode: op === opcodes.OP_NUMEQUALVERIFY ? opcodes.OP_NUMEQUAL : op,
							args: this.takeElements(2)
						});
						if (op === opcodes.OP_EQUALVERIFY && !this.verify()) {
							return ScriptError.SCRIPT_ERR_NUMEQUALVERIFY;
						}
						break;
					}
					case opcodes.OP_WITHIN: {
						this.stack.push({ opcode: op, args: this.takeElements(3) });
						break;
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
						break;
					}
					case opcodes.OP_CHECKSIG:
					case opcodes.OP_CHECKSIGVERIFY: {
						this.stack.push({ opcode: opcodes.OP_CHECKSIG, args: this.takeElements(2) });
						if (op === opcodes.OP_CHECKSIGVERIFY && !this.verify()) {
							return ScriptError.SCRIPT_ERR_CHECKSIGVERIFY;
						}
						break;
					}
					case opcodes.OP_CHECKMULTISIG: {
						throw `${getOpcode(op)} not implemented (yet)`;
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
						throw `${getOpcode(op)} not implemented (yet)`;
					}
					default: {
						return ScriptError.SCRIPT_ERR_BAD_OPCODE;
					}
				}
			}
			if (this.stack.length + this.altstack.length > 1000) {
				return ScriptError.SCRIPT_ERR_STACK_SIZE;
			}
		}

		if (this.stack.length > 1) {
			return ScriptError.SCRIPT_ERR_CLEANSTACK;
		}

		if (!this.verify()) {
			return ScriptError.SCRIPT_ERR_EVAL_FALSE;
		}
	}

	/** OP_VERIFY */
	private verify(): boolean {
		const elem = this.takeElements(1)[0];
		if (elem instanceof Uint8Array) {
			if (!ScriptConv.Bool.decode(elem)) {
				return false;
			}
		} else {
			this.spendingConditions.push(elem);
		}
		return true;
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

	private readElements(amount: number): Stack {
		while (this.stack.length < amount) {
			this.stack.unshift({ var: this.varCounter++ });
		}
		return this.stack.slice(this.stack.length - amount);
	}
}
