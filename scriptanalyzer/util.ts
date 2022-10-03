namespace Util {
	export function scriptElemToHex(buf: Uint8Array): `<${string}>` {
		return `<${bufferToHex(buf)}>`;
	}

	/** Browser proof function to convert a browser proof buffer (Uint8Array) to a hex string */
	export function bufferToHex(buf: Uint8Array): string {
		let hex = '';
		for (let i = 0; i < buf.length; i++) {
			hex += buf[i].toString(16).padStart(2, '0');
		}
		return hex;
	}

	/** Browser proof function to convert a hex string to a browser proof buffer (Uint8Array) */
	export function hexToBuffer(hex: string): Uint8Array {
		return new Uint8Array(hex.match(/../g)?.map(x => parseInt(x, 16)) ?? []);
	}

	export function bufferCompare(buf1: Uint8Array, buf2: Uint8Array): 0 | 1 | -1 {
		for (let i = 0; i < buf1.length && i < buf2.length; i++) {
			if (buf1[i] < buf2[i]) {
				return -1;
			} else if (buf1[i] > buf2[i]) {
				return 1;
			}
		}

		if (buf1.length < buf2.length) {
			return -1;
		} else if (buf1.length > buf2.length) {
			return 1;
		}

		return 0;
	}

	export function intEncodeLEHex(n: number, len: number): string {
		return n
			.toString(16)
			.padStart(len * 2, '0')
			.match(/../g)!
			.reverse()
			.join('');
	}

	export function intDecodeLE(buf: Uint8Array): number {
		return parseInt(bufferToHex(buf.slice().reverse()), 16);
	}

	export function exprToString(e: Expr): string {
		if ('opcode' in e) {
			const args = e.args.map(exprToString);
			if (e.opcode === opcodes.INTERNAL_NOT && args.length === 1) {
				return `!(${args})`;
			} else if (e.opcode === opcodes.OP_EQUAL && args.length === 2) {
				return `(${args[0]} == ${args[1]})`;
			}
			return `${(opcodeName(e.opcode) || 'UNKNOWN').replace(/^OP_/, '')}(${args})`;
		} else if ('var' in e) {
			return `<input${e.var}>`;
		} else {
			return scriptElemToHex(e);
		}
	}

	/** Returns true if at least 1 element of the first list is present in the second list */
	export function overlap<T>(list1: T[], list2: T[]): boolean {
		for (const e of list1) {
			if (list2.includes(e)) {
				return true;
			}
		}
		return false;
	}

	export function exprEqual(a: Expr, b: Expr): boolean {
		if ('opcode' in a && 'opcode' in b) {
			if (a.args.length !== b.args.length) {
				return false;
			}
			for (let i = 0; i < a.args.length; i++) {
				if (!exprEqual(a.args[i], b.args[i])) {
					return false;
				}
			}
			return a.opcode === b.opcode;
		} else if ('var' in a && 'var' in b) {
			return a.var === b.var;
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return !bufferCompare(a, b);
		}
		return false;
	}

	const exprPriority = {
		var: 2,
		opcode: 1,
		value: 0
	};

	function exprType(expr: OpcodeExpr): 'opcode';
	function exprType(expr: StackExpr): 'var';
	function exprType(expr: Uint8Array): 'value';
	function exprType(expr: Expr): 'opcode' | 'var' | 'value';
	function exprType(expr: Expr): 'opcode' | 'var' | 'value' {
		if ('opcode' in expr) {
			return 'opcode';
		} else if ('var' in expr) {
			return 'var';
		} else {
			return 'value';
		}
	}

	function exprCompareFn(a: Expr, b: Expr): number {
		if ('opcode' in a && 'opcode' in b) {
			// smallest opcode first
			const s = a.opcode - b.opcode;
			if (s) {
				return s;
			}
			// only for OP_CHECKMULTISIG (?)
			const ldiff = a.args.length - b.args.length;
			if (ldiff) {
				return ldiff;
			}
			for (let i = 0; i < a.args.length; i++) {
				const s = exprCompareFn(a.args[i], b.args[i]);
				if (s) {
					return s;
				}
			}
		} else if ('var' in a && 'var' in b) {
			// highest stack element first
			return a.var - b.var;
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return bufferCompare(a, b);
		}
		return exprPriority[exprType(b)] - exprPriority[exprType(a)];
	}

	export function normalizeExprs(exprs: Expr[]) {
		exprs.sort(exprCompareFn);
		for (const expr of exprs) {
			if (
				'opcode' in expr &&
				![
					opcodes.OP_CHECKMULTISIG,
					opcodes.OP_CHECKSIG,
					opcodes.OP_GREATERTHAN,
					opcodes.OP_GREATERTHANOREQUAL,
					opcodes.OP_LESSTHAN,
					opcodes.OP_LESSTHANOREQUAL,
					opcodes.OP_SUB,
					opcodes.OP_WITHIN
				].includes(expr.opcode)
			) {
				normalizeExprs(expr.args);
			}
		}
	}
}
