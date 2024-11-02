import * as bitcoin from 'bitcoinjs-lib';
import { strict as assert } from 'assert';

type Txid = string | Buffer;

export function pathToMerkleRoot(
    txids: Txid[],
    branch: Txid,
): { branch: Buffer; action: 'prepend' | 'append' }[] & { root: Buffer } {
    let t1 = txids.map(txid => {
        if (!Buffer.isBuffer(txid)) {
            txid = Buffer.from(txid, 'hex').reverse();
        }
        assert(txid.length == 32, 'TXID must be 256 bits long');
        return txid;
    });

    let curr = Buffer.isBuffer(branch) ? branch : Buffer.from(branch, 'hex').reverse();
    const path: { branch: Buffer; action: 'prepend' | 'append' }[] & { root?: Buffer } = [];

    while (t1.length > 1) {
        const t2 = [];
        while (t1.length) {
            const ids = t1.splice(0, 2);
            if (ids.length == 1) {
                ids.push(ids[0]);
            }
            const hash = bitcoin.crypto.hash256(Buffer.concat(ids));
            if (ids[0].equals(curr)) {
                path.push({ branch: ids[1], action: 'append' });
                curr = hash;
            } else if (ids[1].equals(curr)) {
                path.push({ branch: ids[0], action: 'prepend' });
                curr = hash;
            }
            t2.push(hash);
        }
        t1 = t2;
    }

    assert(t1[0].equals(curr), 'branch not in merkle tree');

    path.root = t1[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return path as any;
}

export function merkleRoot(txids: Txid[]): Buffer {
    return pathToMerkleRoot(txids, txids[0]).root;
}
