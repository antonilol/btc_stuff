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

	/** Returns true if at least 1 element of the first list is present in the second list */
	export function overlap<T>(list1: T[], list2: T[]): boolean {
		for (const e of list1) {
			if (list2.includes(e)) {
				return true;
			}
		}
		return false;
	}

	export function relativeTimelockToString(s: number): string {
		let t = s * 512;
		let output = (t % 60) + 's';
		let prev = 60;
		for (const unit of [
			[ 'm', 60 ],
			[ 'h', 24 ],
			[ 'd', 999 ]
		] as const) {
			t = Math.floor(t / prev);
			if (!t) {
				break;
			}
			output = (t % unit[1]) + unit[0] + ' ' + output;
			prev = unit[1];
		}
		return output;
	}

	export function clone<T>(obj: T): T {
		if (obj instanceof Uint8Array) {
			return new Uint8Array(obj) as T;
		}
		if (typeof obj !== 'object') {
			return obj;
		}
		if (Array.isArray(obj)) {
			return obj.map(clone) as unknown as T;
		}
		const c = {} as T;
		for (const k in obj) {
			c[k] = clone(obj[k]);
		}
		return c;
	}
}
