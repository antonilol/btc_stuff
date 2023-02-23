namespace Expr {
	export function exprToString(e: Expr): string {
		if ('opcode' in e) {
			const args = e.args.map(exprToString);
			if (e.opcode === opcodes.INTERNAL_NOT && args.length === 1) {
				return `!(${args})`;
			} else if (e.opcode === opcodes.OP_EQUAL && args.length === 2) {
				return `(${args[0]} == ${args[1]})`;
			}
			return `${(opcodeName(e.opcode) || 'UNKNOWN').replace(/^OP_/, '')}(${args})`;
		} else if ('index' in e) {
			return `<stack item #${e.index}>`;
		} else {
			return Util.scriptElemToHex(e);
		}
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
		} else if ('index' in a && 'index' in b) {
			return a.index === b.index;
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return !Util.bufferCompare(a, b);
		}
		return false;
	}

	const exprPriority = {
		stack: 2,
		opcode: 1,
		value: 0
	};

	function exprType(expr: OpcodeExpr): 'opcode';
	function exprType(expr: StackExpr): 'stack';
	function exprType(expr: Uint8Array): 'value';
	function exprType(expr: Expr): 'opcode' | 'stack' | 'value';
	function exprType(expr: Expr): 'opcode' | 'stack' | 'value' {
		if ('opcode' in expr) {
			return 'opcode';
		} else if ('index' in expr) {
			return 'stack';
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
		} else if ('index' in a && 'index' in b) {
			// highest stack element first
			return a.index - b.index;
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return Util.bufferCompare(a, b);
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

	export function evalExpr(expr: Expr): Expr | undefined {
		/*
		// TODO
		if (expr instanceof Uint8Array) {
			return ScriptConv.Bool.decode(expr);
		}
		*/

		if ('opcode' in expr) {
			switch (expr.opcode) {
				case opcodes.OP_EQUAL: {
					const [ a1, a2 ] = expr.args;
					if (a1 instanceof Uint8Array && a2 instanceof Uint8Array) {
						return ScriptConv.Bool.encode(!Util.bufferCompare(a1, a2));
					}
					break;
				}
				case opcodes.INTERNAL_NOT:
				case opcodes.OP_NOT: {
					if (expr.args[0] instanceof Uint8Array) {
						return ScriptConv.Bool.not(expr.args[0]);
					}
					const arg = expr.args[0];
					if ('opcode' in arg && arg.opcode === opcodes.OP_CHECKSIG) {
						return { opcode: opcodes.OP_EQUAL, args: [ arg.args[0], ScriptConv.Bool.FALSE ] };
					}
					break;
				}
				/*
				case opcodes.OP_CHECKMULTISIG: {
					const l = expr.args.length;
					const k = (<Uint8Array>expr.args[l - 1])[0];
					const s = (<Uint8Array>expr.args[l - k - 1])[0];
					if (k === s) {
						const output: Expr[] = [];
						for (let i = 0; i < k; i++) {
							output.push({
								opcode: opcodes.OP_CHECKSIG,
								args: [ expr.args[l - i - k - 3], expr.args[l - i - 2] ]
							});
						}
						return output;
					}
					break;
				}
				*/
			}
		}
	}
}

type OpcodeExpr = { opcode: number; args: Expr[] };
type StackExpr = { index: number };
type ExprType = 'pubkey' | 'preimage' | 'signature';
type Expr =
	| ((OpcodeExpr | StackExpr) & {
			types?: ExprType[];
			values?: Uint8Array[];
			len?: number[];
			error?: ScriptError;
	  })
	| Uint8Array;
