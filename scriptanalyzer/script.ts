function asmtohex(asm: string): string {
	const src = asm.split(/\s+/).filter(x => x);
	let script = '';
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
					throw 'Too large decimal integer';
				}
				const s = ScriptConv.Int.encode(n);
				script += Util.intEncodeLEHex(s.length, 1) + Util.bufferToHex(s);
			}
		} else if (/^<[0-9a-fA-F]*>$/.test(op)) {
			const hex = op.slice(1, -1).toLowerCase();
			if (hex.length & 1) {
				throw 'Odd amount of characters in hex literal';
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
				throw 'Data push too large';
			}
			script += hex;
		} else {
			const opcode =
				opcodes[op.toUpperCase() as keyof typeof opcodes] ||
				opcodes[('OP_' + op.toUpperCase()) as keyof typeof opcodes];
			if (opcode === undefined || opcode < 0) {
				throw `Unknown opcode ${op.length > 50 ? op.slice(0, 50) + '..' : op}${
					/^[0-9a-fA-F]+$/.test(op) ? '. Hex data pushes have to be between < and >' : ''
				}`;
			}
			if (pushdataLength[opcode]) {
				throw 'OP_PUSHDATA is not allowed is Bitcoin ASM script';
			}
			script += Util.intEncodeLEHex(opcode, 1);
		}
	}
	return script;
}

type Script = (Uint8Array | number)[];

function parseHexScript(hex: string): Script {
	const v = hex.replace(/\s+/g, '').toLowerCase();
	if (!/^[0-9a-f]*$/.test(v)) {
		throw 'Illegal characters in hex literal';
	}
	if (v.length & 1) {
		throw 'Odd amount of characters in hex literal';
	}
	const bytes = Util.hexToBuffer(v);
	const a: Script = [];
	for (let offset = 0; offset < bytes.length; ) {
		const b = bytes[offset++];
		const op = opcodeName(b);
		if (op) {
			const n = pushdataLength[b];
			if (n) {
				const pushSize = bytes.subarray(offset, offset + n);
				if (pushSize.length !== n) {
					throw `${op} with incomplete push length (SCRIPT_ERR_BAD_OPCODE)`;
				}
				const l = Util.intDecodeLE(pushSize);
				offset += n;
				const data = bytes.subarray(offset, offset + l);
				offset += l;
				if (data.length !== l) {
					throw `Invalid length, expected ${l} but got ${data.length} (SCRIPT_ERR_BAD_OPCODE)`;
				}
				a.push(data);
			} else {
				a.push(b);
			}
		} else if (b <= 75) {
			const data = bytes.subarray(offset, offset + b);
			offset += b;
			if (data.length != b) {
				throw `Invalid length, expected ${b} but got ${data.length} (SCRIPT_ERR_BAD_OPCODE)`;
			}
			a.push(data);
		} else {
			throw `Invalid opcode 0x${b.toString(16).padStart(2, '0')}`;
		}
	}
	return a;
}

function getRedeemScript(scriptSigHex: string): Uint8Array {
	const v = scriptSigHex.replace(/\s+/g, '').toLowerCase();
	if (!/^[0-9a-f]*$/.test(v)) {
		throw 'Illegal characters in hex literal';
	}
	if (v.length & 1) {
		throw 'Odd amount of characters in hex literal';
	}
	const bytes = Util.hexToBuffer(v);
	for (let offset = 0; offset < bytes.length; ) {
		const b = bytes[offset++];
		const op = opcodeName(b);
		if (op) {
			const n = pushdataLength[b];
			if (n) {
				const pushSize = bytes.subarray(offset, offset + n);
				if (pushSize.length !== n) {
					throw `${op} with incomplete push length (SCRIPT_ERR_BAD_OPCODE)`;
				}
				const l = Util.intDecodeLE(pushSize);
				offset += n;
				const data = bytes.subarray(offset, offset + l);
				offset += l;
				if (data.length !== l) {
					throw `Invalid length, expected ${l} but got ${data.length} (SCRIPT_ERR_BAD_OPCODE)`;
				}
				if (offset === bytes.length) {
					return data;
				}
			}
		} else if (b <= 75) {
			const data = bytes.subarray(offset, offset + b);
			offset += b;
			if (data.length != b) {
				throw `Invalid length, expected ${b} but got ${data.length} (SCRIPT_ERR_BAD_OPCODE)`;
			}
			if (offset === bytes.length) {
				return data;
			}
		} else {
			throw `Invalid opcode 0x${b.toString(16).padStart(2, '0')}`;
		}
	}
	throw 'No last element or last element was an opcode';
}

function scriptToAsm(script: Script): { s: string; type: OpcodeType; indent: number }[] {
	const asm: { s: string; type: OpcodeType; indent: number }[] = [];
	let indent = 0;

	for (const op of script) {
		if (op instanceof Uint8Array) {
			if (op.length <= 4) {
				asm.push({ s: '' + ScriptConv.Int.decode(op), type: OpcodeType.NUMBER, indent });
			} else {
				asm.push({ s: Util.scriptElemToHex(op), type: OpcodeType.DATA, indent });
			}
		} else {
			if (op === opcodes.OP_0) {
				asm.push({ s: '0', type: OpcodeType.NUMBER, indent });
			} else if ((op >= opcodes.OP_1 && op <= opcodes.OP_16) || op === opcodes.OP_1NEGATE) {
				asm.push({ s: '' + (op - 0x50), type: OpcodeType.NUMBER, indent });
			} else {
				if ([ opcodes.OP_ELSE, opcodes.OP_ENDIF ].includes(op) && indent > 0) {
					indent--;
				}
				asm.push({ s: opcodeName(op) || 'OP_INVALIDOPCODE', type: opcodeType(op), indent });
				if ([ opcodes.OP_IF, opcodes.OP_NOTIF, opcodes.OP_ELSE ].includes(op)) {
					indent++;
				}
			}
		}
	}

	return asm;
}

enum OpcodeType {
	DATA,
	NUMBER,
	CONSTANT,
	FLOW,
	STACK,
	SPLICE,
	BITWISE,
	ARITHMETIC,
	CRYPTO,
	LOCKTIME,
	DISABLED,
	INVALID
}

function opcodeType(op: number): OpcodeType {
	if (disabledOpcodes.includes(op)) {
		return OpcodeType.DISABLED;
	} else if ([ opcodes.OP_VER, opcodes.OP_VERIF, opcodes.OP_VERNOTIF ].includes(op)) {
		return OpcodeType.INVALID;
	} else if (op >= 0 && op <= opcodes.OP_PUSHDATA4) {
		return OpcodeType.CONSTANT;
	} else if (op >= opcodes.OP_NOP && op <= opcodes.OP_RETURN) {
		return OpcodeType.FLOW;
	} else if (op >= opcodes.OP_TOALTSTACK && op <= opcodes.OP_TUCK) {
		return OpcodeType.STACK;
	} else if (op >= opcodes.OP_CAT && op <= opcodes.OP_SIZE) {
		return OpcodeType.SPLICE;
	} else if (op >= opcodes.OP_INVERT && op <= opcodes.OP_EQUALVERIFY) {
		return OpcodeType.BITWISE;
	} else if (op >= opcodes.OP_1ADD && op <= opcodes.OP_WITHIN) {
		return OpcodeType.ARITHMETIC;
	} else if ((op >= opcodes.OP_RIPEMD160 && op <= opcodes.OP_CHECKMULTISIGVERIFY) || op === opcodes.OP_CHECKSIGADD) {
		return OpcodeType.CRYPTO;
	} else if (op >= opcodes.OP_CHECKLOCKTIMEVERIFY && op <= opcodes.OP_CHECKSEQUENCEVERIFY) {
		return OpcodeType.LOCKTIME;
	}
	return OpcodeType.INVALID;
}

/*

TODO maybe flags from bitcoin core

MANDATORY_SCRIPT_VERIFY_FLAGS = SCRIPT_VERIFY_P2SH

consensus:
MANDATORY_SCRIPT_VERIFY_FLAGS

relay:
MANDATORY_SCRIPT_VERIFY_FLAGS
SCRIPT_VERIFY_DERSIG
SCRIPT_VERIFY_STRICTENC
SCRIPT_VERIFY_MINIMALDATA
SCRIPT_VERIFY_NULLDUMMY
SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS
SCRIPT_VERIFY_CLEANSTACK
SCRIPT_VERIFY_MINIMALIF
SCRIPT_VERIFY_NULLFAIL
SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY
SCRIPT_VERIFY_CHECKSEQUENCEVERIFY
SCRIPT_VERIFY_LOW_S
SCRIPT_VERIFY_WITNESS
SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM
SCRIPT_VERIFY_WITNESS_PUBKEYTYPE
SCRIPT_VERIFY_CONST_SCRIPTCODE
SCRIPT_VERIFY_TAPROOT
SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION
SCRIPT_VERIFY_DISCOURAGE_OP_SUCCESS
SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_PUBKEYTYPE

*/
