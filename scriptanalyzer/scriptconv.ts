namespace ScriptConv {
	export namespace Int {
		export function encode(n: number): Uint8Array {
			const buf: number[] = [];
			const neg = n < 0;
			let abs = Math.abs(n);
			while (abs) {
				buf.push(abs & 0xff);
				abs >>= 8;
			}
			if (buf[buf.length - 1] & 0x80) {
				buf.push(neg ? 0x80 : 0x00);
			} else if (neg) {
				buf[buf.length - 1] |= 0x80;
			}

			return new Uint8Array(buf);
		}

		export function encodeHex(n: number): string {
			return Util.bufferToHex(encode(n));
		}

		export function decode(buf: Uint8Array): number {
			if (!buf.length) {
				return 0;
			}

			const neg = buf[buf.length - 1] & 0x80;
			if (neg) {
				// clone before editing
				buf = buf.slice();
				buf[buf.length - 1] &= 0x7f;
			}

			let n = 0;
			for (let i = 0; i != buf.length; ++i) {
				n |= buf[i] << (i * 8);
			}

			return neg ? -n : n;
		}
	}

	export namespace Bool {
		export const FALSE = new Uint8Array();
		export const TRUE = new Uint8Array([ 1 ]);

		export function encode(b: boolean): Uint8Array {
			return b ? TRUE : FALSE;
		}

		export function decode(buf: Uint8Array): boolean {
			for (let i = 0; i < buf.length; i++) {
				if (buf[i] !== 0) {
					return i !== buf.length - 1 || buf[i] !== 0x80;
				}
			}
			return false;
		}

		export function not(buf: Uint8Array): Uint8Array {
			return encode(!decode(buf));
		}
	}
}
