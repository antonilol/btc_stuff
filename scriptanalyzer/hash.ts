namespace Hash {
	/** sha1(data) */
	export async function sha1(data: Uint8Array): Promise<Uint8Array> {
		return new Uint8Array(await crypto.subtle.digest('SHA-1', data));
	}

	/** sha256(data) */
	export async function sha256(data: Uint8Array): Promise<Uint8Array> {
		return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
	}

	/** sha256(sha256(data)) */
	export async function hash256(data: Uint8Array): Promise<Uint8Array> {
		return new Uint8Array(await crypto.subtle.digest('SHA-256', await crypto.subtle.digest('SHA-256', data)));
	}

	/** ripemd160(sha256(data)) */
	export async function hash160(data: Uint8Array): Promise<Uint8Array> {
		return ripemd160(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
	}

	const tagHashes: { [tag: string]: Promise<Uint8Array> } = {};
	async function getTagHash(t: string): Promise<Uint8Array> {
		let tagHash = tagHashes[t];
		if (!tagHash) {
			tagHash = tagHashes[t] = crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(buf => {
				const tag = new Uint8Array(64);
				const hash = new Uint8Array(buf);
				tag.set(hash);
				tag.set(hash, 32);
				return tag;
			});
		}
		return tagHash;
	}

	/** sha256(sha256(tag) || sha256(tag) || data) */
	export async function sha256tagged(tag: string, data: Uint8Array): Promise<Uint8Array> {
		const dat = new Uint8Array(64 + data.length);
		dat.set(await getTagHash(tag));
		dat.set(data, 64);
		return new Uint8Array(await crypto.subtle.digest('SHA-256', dat));
	}

	// parts of the ripemd160 code copied from https://raw.githubusercontent.com/crypto-browserify/ripemd160/3419c6409799d37e0323a556c94d040154657d9d/index.js
	const zl = new Uint8Array([
		0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10,
		14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7,
		12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
	]);

	const zr = new Uint8Array([
		5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5,
		1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4,
		1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
	]);

	const sl = new Uint8Array([
		11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11,
		13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15,
		5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
	]);

	const sr = new Uint8Array([
		8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9,
		7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5,
		12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
	]);

	const hl = new Uint32Array([ 0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e ]);
	const hr = new Uint32Array([ 0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000 ]);

	function rotl(x: number, n: number): number {
		return (x << n) | (x >>> (32 - n));
	}

	function fn1(a: number, b: number, c: number, d: number, e: number, m: number, k: number, s: number): number {
		return (rotl((a + (b ^ c ^ d) + m + k) | 0, s) + e) | 0;
	}

	function fn2(a: number, b: number, c: number, d: number, e: number, m: number, k: number, s: number): number {
		return (rotl((a + ((b & c) | (~b & d)) + m + k) | 0, s) + e) | 0;
	}

	function fn3(a: number, b: number, c: number, d: number, e: number, m: number, k: number, s: number): number {
		return (rotl((a + ((b | ~c) ^ d) + m + k) | 0, s) + e) | 0;
	}

	function fn4(a: number, b: number, c: number, d: number, e: number, m: number, k: number, s: number): number {
		return (rotl((a + ((b & d) | (c & ~d)) + m + k) | 0, s) + e) | 0;
	}

	function fn5(a: number, b: number, c: number, d: number, e: number, m: number, k: number, s: number): number {
		return (rotl((a + (b ^ (c | ~d)) + m + k) | 0, s) + e) | 0;
	}

	function ripemd160_transform(state: { [n in 'a' | 'b' | 'c' | 'd' | 'e']: number }, data: Int32Array) {
		let al = state.a | 0;
		let bl = state.b | 0;
		let cl = state.c | 0;
		let dl = state.d | 0;
		let el = state.e | 0;

		let ar = state.a | 0;
		let br = state.b | 0;
		let cr = state.c | 0;
		let dr = state.d | 0;
		let er = state.e | 0;

		let tl: number;
		let tr: number;
		for (let i = 0; i < 80; i++) {
			if (i < 16) {
				tl = fn1(al, bl, cl, dl, el, data[zl[i]], hl[0], sl[i]);
				tr = fn5(ar, br, cr, dr, er, data[zr[i]], hr[0], sr[i]);
			} else if (i < 32) {
				tl = fn2(al, bl, cl, dl, el, data[zl[i]], hl[1], sl[i]);
				tr = fn4(ar, br, cr, dr, er, data[zr[i]], hr[1], sr[i]);
			} else if (i < 48) {
				tl = fn3(al, bl, cl, dl, el, data[zl[i]], hl[2], sl[i]);
				tr = fn3(ar, br, cr, dr, er, data[zr[i]], hr[2], sr[i]);
			} else if (i < 64) {
				tl = fn4(al, bl, cl, dl, el, data[zl[i]], hl[3], sl[i]);
				tr = fn2(ar, br, cr, dr, er, data[zr[i]], hr[3], sr[i]);
			} else {
				tl = fn5(al, bl, cl, dl, el, data[zl[i]], hl[4], sl[i]);
				tr = fn1(ar, br, cr, dr, er, data[zr[i]], hr[4], sr[i]);
			}

			al = el;
			el = dl;
			dl = rotl(cl, 10);
			cl = bl;
			bl = tl;

			ar = er;
			er = dr;
			dr = rotl(cr, 10);
			cr = br;
			br = tr;
		}

		const t = (state.b + cl + dr) | 0;
		state.b = (state.c + dl + er) | 0;
		state.c = (state.d + el + ar) | 0;
		state.d = (state.e + al + br) | 0;
		state.e = (state.a + bl + cr) | 0;
		state.a = t;
	}

	/** ripemd160(data) */
	export function ripemd160(data: Uint8Array): Uint8Array {
		const block = new Int32Array(16);
		const blocku8 = new Uint8Array(block.buffer);
		const blocku32 = new Uint32Array(block.buffer);
		const state = {
			a: 0x67452301,
			b: 0xefcdab89,
			c: 0x98badcfe,
			d: 0x10325476,
			e: 0xc3d2e1f0
		};
		let offset = 0;
		let blockOffset = 0;

		while (blockOffset + data.length - offset >= 64) {
			let i = blockOffset;
			while (i < 64) {
				blocku8[i++] = data[offset++];
			}
			ripemd160_transform(state, block);
			blockOffset = 0;
		}

		while (offset < data.length) {
			blocku8[blockOffset++] = data[offset++];
		}

		blocku8[blockOffset++] = 0x80;

		if (blockOffset > 56) {
			blocku8.fill(0, blockOffset, 64);
			ripemd160_transform(state, block);
			blockOffset = 0;
		}

		blocku8.fill(0, blockOffset, 56);

		// shortcut for data.length < 4294967296 (4 gigabyte)
		// let l1 = data.length * 8;
		// let l2 = (l1 / 0x0100000000) | 0;
		// if (l2 > 0) {
		// 	l1 -= 0x0100000000 * l2;
		// }
		blocku32[14] = data.length * 8; // l1;

		// const l3 = (l2 / 0x0100000000) | 0;
		// if (l3 > 0) {
		// 	l2 -= 0x0100000000 * l3;
		// }
		blocku32[15] = 0; // l2;

		ripemd160_transform(state, block);

		return new Uint8Array(new Int32Array([ state.a, state.b, state.c, state.d, state.e ]).buffer);
	}
}
