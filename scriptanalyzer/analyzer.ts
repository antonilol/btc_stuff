class ScriptAnalyzer {
	private readonly version: ScriptVersion;
	private readonly rules: ScriptRules;
	private readonly stack: Expr[];
	private readonly altstack: Expr[];
	private readonly spendingConditions: Expr[];
	private varCounter: number;
	private readonly script: Script;
	private scriptOffset: number;
	private readonly path: number;
	private readonly cs: ConditionStack;
	private readonly branches: ScriptAnalyzer[];

	/** Pass an array of (Uint8Array | number) where a Uint8Array is a data push and a number is an opcode */
	public static analyzeScript(script: Script): string | undefined {
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

		analyzer.cleanupConditions();
	}

	private constructor(arg: Script | ScriptAnalyzer) {
		if (arg instanceof ScriptAnalyzer) {
			this.version = arg.version;
			this.rules = arg.rules;
			this.stack = arg.stack.slice();
			this.altstack = arg.altstack.slice();
			this.spendingConditions = arg.spendingConditions.slice();
			this.varCounter = arg.varCounter;
			this.script = arg.script;
			this.scriptOffset = arg.scriptOffset;
			this.path = arg.path + 1;
			this.cs = arg.cs.clone();
			this.branches = arg.branches;
			this.branches.push(this);
		} else {
			this.version = getScriptVersion();
			this.rules = getScriptRules();
			this.stack = [];
			this.altstack = [];
			this.spendingConditions = [];
			this.varCounter = 0;
			this.script = arg;
			this.scriptOffset = 0;
			this.path = 0;
			this.cs = new ConditionStack();
			this.branches = [ this ];
		}
	}

	printSpendingConditions(conds: Expr[][]): void {
		console.log(conds.map(exprs => exprs.map(expr => Util.exprToString(expr)).join(' && ')).join(' ||\n'));
		// console.log('stack', this.stack);
		// console.log('altstack', this.altstack);
	}

	private evalExpr(expr: Expr): Expr | undefined {
		/*
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

	private cleanupConditions(): void | ScriptError {
		const conds = this.branches.map(b => b.spendingConditions);
		for (let i = 0; i < conds.length; i++) {
			const exprs = conds[i];
			Util.normalizeExprs(exprs);
			exprs: for (let j = 0; j < exprs.length; j++) {
				const expr = exprs[j];
				for (let k = j + 1; k < exprs.length; k++) {
					const expr2 = exprs[k];
					if (Util.exprEqual(expr, expr2)) {
						exprs.splice(k, 1);
						k--;
					} else if (
						('opcode' in expr &&
							(expr.opcode === opcodes.OP_NOT || expr.opcode === opcodes.INTERNAL_NOT) &&
							Util.exprEqual(expr.args[0], exprs[k])) ||
						('opcode' in expr2 &&
							(expr2.opcode === opcodes.OP_NOT || expr2.opcode === opcodes.INTERNAL_NOT) &&
							Util.exprEqual(expr, expr2.args[0]))
					) {
						conds.splice(i, 1);
						i--;
						break exprs;
					}
				}
				const res = this.evalExpr(expr);
				if (typeof res === 'boolean') {
					if (res) {
						exprs.splice(j, 1);
						j--;
						// continue;
					} else {
						conds.splice(i, 1);
						i--;
						break;
					}
				} else if (res) {
					exprs[j] = res;
					j--;
				}
			}
		}
		this.printSpendingConditions(conds);
	}

	private analyze(): void | ScriptError {
		while (this.scriptOffset < this.script.length) {
			const fExec = this.cs.all_true();
			const op = this.script[this.scriptOffset++];
			if (!fExec && (op instanceof Uint8Array || op < opcodes.OP_IF || op > opcodes.OP_ENDIF)) {
				continue;
			}
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

					case opcodes.OP_IF:
					case opcodes.OP_NOTIF: {
						if (fExec) {
							const minimalIf =
								this.version === ScriptVersion.SEGWITV1 ||
								(this.version === ScriptVersion.SEGWITV0 && this.rules === ScriptRules.ALL);
							const elem = this.takeElements(1)[0];
							const fork = new ScriptAnalyzer(this);
							this.cs.push_back(op === opcodes.OP_IF);
							fork.cs.push_back(op !== opcodes.OP_IF);
							if (minimalIf) {
								const error =
									this.version === ScriptVersion.SEGWITV1
										? ScriptError.SCRIPT_ERR_TAPSCRIPT_MINIMALIF
										: ScriptError.SCRIPT_ERR_MINIMALIF;
								this.spendingConditions.push({ opcode: opcodes.OP_EQUAL, args: [ elem, ScriptConv.Bool.TRUE ], error });
								fork.spendingConditions.push({ opcode: opcodes.OP_EQUAL, args: [ elem, ScriptConv.Bool.FALSE ], error });
							} else {
								this.spendingConditions.push(elem);
								fork.spendingConditions.push({ opcode: opcodes.INTERNAL_NOT, args: [ elem ] });
							}
							fork.analyze();
						} else {
							this.cs.push_back(false);
						}
						break;
					}

					case opcodes.OP_ELSE: {
						if (this.cs.empty()) {
							return ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL;
						}
						this.cs.toggle_top();
						break;
					}

					case opcodes.OP_ENDIF: {
						if (this.cs.empty()) {
							return ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL;
						}
						this.cs.pop_back();
						break;
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
						this.stack.push(this.altstack.pop()!);
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
						const elem = this.readElements(1)[0];
						const fork = new ScriptAnalyzer(this);
						this.spendingConditions.push(elem);
						this.stack.push(elem);
						fork.spendingConditions.push({ opcode: opcodes.INTERNAL_NOT, args: [ elem ] });
						fork.analyze();
						break;
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
						const index = this.numFromStack(op);
						if (!index) {
							return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
						}
						if (index.n < 0) {
							return ScriptError.SCRIPT_ERR_INVALID_STACK_OPERATION;
						}
						const elem = this.readElements(index.n + 1)[0];
						if (op === opcodes.OP_ROLL) {
							this.stack.splice(this.stack.length - index.n - 1, 1);
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
						this.stack.push({ opcode: op, args: this.readElements(1) });
						break;
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

					case opcodes.OP_CHECKMULTISIG:
					case opcodes.OP_CHECKMULTISIGVERIFY: {
						if (this.version === ScriptVersion.SEGWITV1) {
							return ScriptError.SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG;
						}
						// TODO fix this mess
						const kcount = this.numFromStack(op);
						if (!kcount) {
							return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
						}
						if (kcount.n < 0 || kcount.n > 20) {
							return ScriptError.SCRIPT_ERR_PUBKEY_COUNT;
						}
						const pks = this.takeElements(kcount.n);

						const scount = this.numFromStack(op);
						if (!scount) {
							return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
						}
						if (scount.n < 0 || scount.n > kcount.n) {
							return ScriptError.SCRIPT_ERR_SIG_COUNT;
						}
						const sigs = this.takeElements(scount.n);
						const dummy = this.takeElements(1)[0];
						this.spendingConditions.push({
							opcode: opcodes.OP_EQUAL,
							args: [ dummy, ScriptConv.Bool.FALSE ],
							error: ScriptError.SCRIPT_ERR_SIG_NULLDUMMY
						});

						this.stack.push({
							opcode: opcodes.OP_CHECKMULTISIG,
							args: [ ...sigs, ScriptConv.Int.encode(scount.n), ...pks, ScriptConv.Int.encode(kcount.n) ]
						});
						if (op === opcodes.OP_CHECKMULTISIGVERIFY && !this.verify()) {
							return ScriptError.SCRIPT_ERR_CHECKMULTISIGVERIFY;
						}
						break;
					}

					case opcodes.OP_CHECKLOCKTIMEVERIFY:
					case opcodes.OP_CHECKSEQUENCEVERIFY: {
						this.spendingConditions.push({ opcode: op, args: this.readElements(1) });
						break;
					}

					case opcodes.OP_NOP1:
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
						if (this.version < ScriptVersion.SEGWITV1) {
							return ScriptError.SCRIPT_ERR_BAD_OPCODE;
						}
						const [ sig, n, pk ] = this.takeElements(3);
						this.stack.push({ opcode: opcodes.OP_ADD, args: [ n, { opcode: opcodes.OP_CHECKSIG, args: [ sig, pk ] } ] });
						break;
					}

					default: {
						return ScriptError.SCRIPT_ERR_BAD_OPCODE;
					}
				}
			}
			/*
			// i really like debugging! :)
			console.log('exec   ' + fExec);
			console.log('path   ' + this.path);
			console.log('op     ' + (typeof op === 'number' ? getOpcode(op) : ('push ' + op.length)));
			console.log('stack  ' + this.stack.map(a => a instanceof Uint8Array ? Util.scriptElemToHex(a) : Util.exprToString(a)).join(', '));
			console.log('verify ' + this.spendingConditions.map(s => Util.exprToString(s)).join(' && '));
			console.log('');
			*/
			if (this.stack.length + this.altstack.length > 1000) {
				return ScriptError.SCRIPT_ERR_STACK_SIZE;
			}
		}

		if (!this.cs.empty()) {
			return ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL;
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
			/*
			if ('opcode' in elem && elem.opcode === opcodes.OP_CHECKMULTISIG) {
				const l = elem.args.length;
				const k = (<Uint8Array>elem.args[l - 1])[0];
				const s = (<Uint8Array>elem.args[l - k - 1])[0];
				if (k === s) {
					for (let i = 0; i < k; i++) {
						this.spendingConditions.push({
							opcode: opcodes.OP_CHECKSIG,
							args: [ elem.args[l - i - k - 3], elem.args[l - i - 2] ]
						});
					}
					return true;
				}
			}
			*/
			this.spendingConditions.push(elem);
		}
		return true;
	}

	private numFromStack(op: number): { n: number } | void {
		const top = this.takeElements(1)[0];
		if (!(top instanceof Uint8Array)) {
			throw `${opcodeName(op)} can't use stack/output values as depth (yet)`;
		}
		if (top.length <= 4) {
			return { n: ScriptConv.Int.decode(top) };
		}
	}

	private takeElements(amount: number): Expr[] {
		const res: Expr[] = [];
		for (let i = 0; i < amount; i++) {
			if (this.stack.length) {
				res.unshift(<Expr>this.stack.pop());
			} else {
				res.unshift({ var: this.varCounter++ });
			}
		}
		return res;
	}

	private readElements(amount: number): Expr[] {
		while (this.stack.length < amount) {
			this.stack.unshift({ var: this.varCounter++ });
		}
		return this.stack.slice(this.stack.length - amount);
	}
}
