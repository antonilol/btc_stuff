import * as bitcoin from 'bitcoinjs-lib';
import { strict as assert } from 'assert';

export function merkleRoot(txids: (string | Buffer)[]): Buffer {
	let t1 = txids.map(txid => {
		if (!Buffer.isBuffer(txid)) {
			txid = Buffer.from(txid, 'hex').reverse();
		}
		assert(txid.length == 32, 'TXID must be 256 bits long');
		return txid;
	});

	while (t1.length > 1) {
		const t2 = [];
		while (t1.length) {
			const ids = t1.splice(0, 2);
			if (ids.length == 1) {
				ids.push(ids[0]);
			}
			t2.push(bitcoin.crypto.hash256(Buffer.concat(ids)));
		}
		t1 = t2;
	}

	return t1[0];
}
