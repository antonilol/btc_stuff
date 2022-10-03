enum ScriptVersion {
	LEGACY,
	SEGWITV0,
	SEGWITV1
}

enum ScriptRules {
	ALL,
	CONSENSUS_ONLY
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

// /** Object A without B's properties or vice versa */
// type OR<A, B> = (B & { [T in Exclude<keyof A, keyof B>]?: never }) | (A & { [T in Exclude<keyof B, keyof A>]?: never });

type OpcodeExpr = { opcode: number; args: Expr[] };
type StackExpr = { var: number };
type Expr =
	| ((OpcodeExpr | StackExpr) & {
			// type?: ElementType;
			values?: Uint8Array[];
			len?: number[];
			error?: ScriptError;
	  })
	| Uint8Array;
type Script = (Uint8Array | number)[];

// unused
enum ElementType {
	/** Only for minimal encoded booleans. Has 2 possible values: <> and <01> */
	bool,
	/** Any stack element not larger than 4 bytes */
	int,
	/** Any stack element not larger than 5 bytes */
	uint,
	/** Any stack element */
	bytes
}

function isElementType(type: ElementType, test: unknown): boolean {
	return typeof test === 'number' && test in ElementType && test <= type;
}
