namespace Util {
	export function scriptElemToHex(buf: Uint8Array): string {
		return '<' + bufferToHex(buf) + '>';
	}

	export function bufferToHex(buf: Uint8Array): string {
		var hex = '';
		for (var i = 0; i < buf.length; i++) {
			hex += buf[i].toString(16).padStart(2, '0');
		}
		return hex;
	}

	export function hexToBuffer(hex: string): Uint8Array {
		return new Uint8Array(hex.match(/../g)?.map(x => parseInt(x, 16)));
	}

	export function intEncodeLEHex(n: number, len: number): string {
		return n
			.toString(16)
			.padStart(len * 2, '0')
			.match(/../g)
			.reverse()
			.join('');
	}

	export function intDecodeLE(buf: Uint8Array): number {
		return parseInt(bufferToHex(buf.slice().reverse()), 16);
	}

	export function exprToString(e: Expr): string {
		if ('opcode' in e) {
			return `${(getOpcode(e.opcode) || 'UNKNOWN').replace(/^OP_/, '')}(${e.args.map(a =>
				a instanceof Uint8Array ? scriptElemToHex(a) : exprToString(a)
			)})`;
		} else {
			return `<input${e.var}>`;
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
}
