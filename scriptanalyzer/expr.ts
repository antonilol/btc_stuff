namespace Expr {
	export function toString(e: Expr, depth = 0): string {
		if ('opcode' in e) {
			const args = e.args.map(a => toString(a, depth + 1));
			if (e.opcode === opcodes.INTERNAL_NOT && args.length === 1) {
				return `!(${args})`;
			} else if (e.opcode === opcodes.OP_EQUAL && args.length === 2) {
				const s = `${args[0]} == ${args[1]}`;
				if (depth) {
					return `(${s})`;
				} else {
					return s;
				}
			}
			return `${(opcodeName(e.opcode) || 'UNKNOWN').replace(/^OP_/, '')}(${args})`;
		} else if ('index' in e) {
			return `<stack item #${e.index}>`;
		} else {
			return Util.scriptElemToHex(e);
		}
	}

	export function equal(a: Expr, b: Expr): boolean {
		if ('opcode' in a && 'opcode' in b) {
			if (a.args.length !== b.args.length) {
				return false;
			}
			for (let i = 0; i < a.args.length; i++) {
				if (!equal(a.args[i], b.args[i])) {
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

	export function type(expr: OpcodeExpr): 'opcode';
	export function type(expr: StackExpr): 'stack';
	export function type(expr: Uint8Array): 'value';
	export function type(expr: Expr): 'opcode' | 'stack' | 'value';
	export function type(expr: Expr): 'opcode' | 'stack' | 'value' {
		if ('opcode' in expr) {
			return 'opcode';
		} else if ('index' in expr) {
			return 'stack';
		} else {
			return 'value';
		}
	}

	type ExprType = ReturnType<typeof type>;

	const exprPriority = {
		opcode: 2,
		stack: 1,
		value: 0
	} as const satisfies { [type in ExprType]: number };

	export function priority(expr: OpcodeExpr): 2;
	export function priority(expr: StackExpr): 1;
	export function priority(expr: Uint8Array): 0;
	export function priority(expr: Expr): 0 | 1 | 2;
	export function priority(expr: Expr): 0 | 1 | 2 {
		return exprPriority[type(expr)];
	}

	function compareFn(a: Expr, b: Expr): number {
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
				const s = compareFn(a.args[i], b.args[i]);
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
		return priority(b) - priority(a);
	}

	export function normalizeExprs(exprs: Expr[]) {
		exprs.sort(compareFn);
		for (const expr of exprs) {
			if ('opcode' in expr && !argumentOrderMatters.includes(expr.opcode)) {
				normalizeExprs(expr.args);
			}
		}
	}

	export function evalExpr(
		ctx: { readonly version: ScriptVersion; readonly rules: ScriptRules },
		expr: Expr,
		depth = 0
	): Expr | undefined {
		expr = Util.clone(expr);
		let changed = false;
		if ('opcode' in expr) {
			for (let i = 0; i < expr.args.length; i++) {
				const res = evalExpr(ctx, expr.args[i], depth + 1);
				if (res) {
					expr.args[i] = res;
					changed = true;
				}
			}
			switch (expr.opcode) {
				case opcodes.OP_EQUAL: {
					const [ a1, a2 ] = expr.args;
					if (a1 instanceof Uint8Array && a2 instanceof Uint8Array) {
						return ScriptConv.Bool.encode(!Util.bufferCompare(a1, a2));
					} else if (
						'opcode' in a1 &&
						returnsBoolean.includes(a1.opcode) &&
						a2 instanceof Uint8Array &&
						(a2.length === 0 || (a2.length === 1 && a2[0] === 1))
					) {
						if (ScriptConv.Bool.decode(a2)) {
							return a1;
						} else {
							return { opcode: opcodes.OP_NOT, args: [ a1 ] };
						}
					}
					break;
				}
				case opcodes.INTERNAL_NOT:
				case opcodes.OP_NOT: {
					const arg = expr.args[0];
					if (arg instanceof Uint8Array) {
						if (expr.opcode === opcodes.OP_NOT && arg.length > 4) {
							throw ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
						}
						return ScriptConv.Bool.not(arg);
					}
					if (
						'opcode' in arg &&
						(arg.opcode === opcodes.OP_NOT || arg.opcode === opcodes.INTERNAL_NOT) &&
						(('opcode' in arg.args[0] && returnsBoolean.includes(arg.args[0].opcode)) ||
							('index' in arg.args[0] && depth === 0))
					) {
						return arg.args[0];
					}
					if (depth === 0 && 'opcode' in arg && arg.opcode === opcodes.OP_CHECKSIG && ctx.rules === ScriptRules.ALL) {
						// assumes valid pubkey TODO fix
						return { opcode: opcodes.OP_EQUAL, args: [ arg.args[0], ScriptConv.Bool.FALSE ] };
					}
					break;
				}
				case opcodes.OP_CHECKSIG: {
					const [ sig, pubkey ] = expr.args;
					if (ctx.version === ScriptVersion.SEGWITV1) {
						if (pubkey instanceof Uint8Array) {
							if (pubkey.length === 0) {
								throw ScriptError.SCRIPT_ERR_PUBKEYTYPE;
							} else if (pubkey.length !== 32) {
								if (ctx.rules === ScriptRules.ALL) {
									throw ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE;
								} else {
									return ScriptConv.Bool.TRUE;
								}
							}
							if (sig instanceof Uint8Array) {
								if (sig.length === 0) {
									return ScriptConv.Bool.FALSE;
								} else if (sig.length !== 64 && sig.length !== 65) {
									throw ScriptError.SCRIPT_ERR_SCHNORR_SIG_SIZE;
								} else if (sig.length === 65 && !sigHashTypes.includes(sig[64])) {
									throw ScriptError.SCRIPT_ERR_SCHNORR_SIG_HASHTYPE;
								}
							}
						}
					} else {
						if (pubkey instanceof Uint8Array) {
							// TODO CheckPubKeyEncoding without SCRIPT_VERIFY_STRICTENC?
							const type = pubkeyType(pubkey);
							if (!type.valid) {
								throw ScriptError.SCRIPT_ERR_PUBKEYTYPE;
							} else if (!type.compressed && ctx.version === ScriptVersion.SEGWITV0 && ctx.rules === ScriptRules.ALL) {
								throw ScriptError.SCRIPT_ERR_WITNESS_PUBKEYTYPE;
							}
							if (sig instanceof Uint8Array) {
								if (sig.length === 0) {
									return ScriptConv.Bool.FALSE;
								}
								if (ctx.rules === ScriptRules.ALL) {
									// TODO low s
									if (!isValidSignatureEncoding(sig)) {
										throw ScriptError.SCRIPT_ERR_SIG_DER;
									} else if (!sigHashTypes.includes(sig[sig.length - 1])) {
										throw ScriptError.SCRIPT_ERR_SIG_HASHTYPE;
									}
								}
							}
						}
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

		if (changed) {
			return expr;
		}
	}

	/** Returns c with all a replaced with b */
	export function replaceAllIn(a: Expr, b: Expr, c: Expr): Expr {
		if (equal(a, c)) {
			return b;
		}
		if ('opcode' in c) {
			return { ...Util.clone(c), args: c.args.map(e => replaceAllIn(a, b, e)) };
		}
		return c;
	}
}

type OpcodeExpr = { opcode: number; args: Expr[] };
type StackExpr = { index: number };
type ExprType = 'pubkey' | 'preimage' | 'signature';
type Expr =
	| ((OpcodeExpr | StackExpr) & {
			// types?: ExprType[];
			// values?: Uint8Array[];
			// len?: number[];
			error?: ScriptError;
	  })
	| Uint8Array;
