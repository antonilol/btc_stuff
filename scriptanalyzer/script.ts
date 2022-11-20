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
				opcodes[<keyof typeof opcodes>op.toUpperCase()] || opcodes[<keyof typeof opcodes>('OP_' + op.toUpperCase())];
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

function scriptToAsm(script: Script): { s: string; t: OpcodeType }[] {
	const asm: { s: string; t: OpcodeType }[] = [];
	for (const op of script) {
		if (op instanceof Uint8Array) {
			if (op.length <= 4) {
				asm.push({ s: '' + ScriptConv.Int.decode(op), t: OpcodeType.NUMBER });
			} else {
				asm.push({ s: Util.scriptElemToHex(op), t: OpcodeType.DATA });
			}
		} else {
			if (op === opcodes.OP_0) {
				asm.push({ s: '0', t: OpcodeType.NUMBER });
			} else if ((op >= opcodes.OP_1 && op <= opcodes.OP_16) || op === opcodes.OP_1NEGATE) {
				asm.push({ s: '' + (op - 0x50), t: OpcodeType.NUMBER });
			} else {
				asm.push({ s: opcodeName(op) || 'OP_INVALIDOPCODE', t: opcodeType(op) });
			}
		}
	}
	return asm;
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