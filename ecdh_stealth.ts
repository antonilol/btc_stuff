import * as bitcoin from 'bitcoinjs-lib';
import bs58check from 'bs58check';
import { randomBytes } from 'crypto';
import * as curve from 'tiny-secp256k1';

export class StealthAddress {
    readonly spendPriv?: Buffer;
    readonly viewPriv?: Buffer;
    readonly spendPub: Buffer;
    readonly viewPub: Buffer;

    constructor(spendPrivKey: Buffer);
    constructor(spendPubKey: Buffer, viewKey: Buffer);
    constructor(spendKey: Buffer, viewKey?: Buffer) {
        if (spendKey.length == 32) {
            this.spendPriv = spendKey;
        } else if (spendKey.length == 33) {
            if (viewKey.length == 32) {
                this.viewPriv = viewKey;
            } else if (viewKey.length == 33) {
                this.viewPub = viewKey;
            } else {
                throw new Error('Invalid viewKey length');
            }
            this.spendPub = spendKey;
        } else {
            throw new Error('Invalid spendKey length');
        }

        if (this.spendPriv) {
            this.viewPriv = bitcoin.crypto.sha256(this.spendPriv);
            this.spendPub = Buffer.from(curve.pointFromScalar(this.spendPriv));
        }
        if (this.viewPriv) {
            this.viewPub = Buffer.from(curve.pointFromScalar(this.viewPriv));
        }
    }

    static makeRandom() {
        return new StealthAddress(randomBytes(32));
    }

    hasPrivateSpendKey(): boolean {
        return !!this.spendPriv;
    }

    hasPrivateViewKey(): boolean {
        return !!this.viewPriv;
    }

    isWatchOnly(): boolean {
        return !this.hasPrivateSpendKey() && this.hasPrivateViewKey();
    }

    isPublic(): boolean {
        return !this.hasPrivateSpendKey() && !this.hasPrivateViewKey();
    }

    getWatchOnlyKey(): StealthAddress {
        return new StealthAddress(this.spendPub, this.viewPriv);
    }

    getPublicKey(): StealthAddress {
        return new StealthAddress(this.spendPub, this.viewPub);
    }

    /** When sending from a taproot address, add '02' in front of the senderKey */
    deriveOneTimeKey(
        senderKey: Buffer,
        prevTxid: Buffer,
        prevVout: number,
        vout: number,
    ): { privateKey?: Buffer; publicKey: Buffer } {
        // 33 bytes ecdh shared secret, 32 bytes uint256le prevTxid, 4 bytes uint32le prevVout, 4 bytes uint32le vout
        const secret = Buffer.allocUnsafe(73);

        if (senderKey.length == 32) {
            Buffer.from(curve.pointMultiply(this.viewPub, senderKey)).copy(secret);
        } else if (senderKey.length == 33) {
            if (!this.viewPriv) {
                throw new Error('Private view key is needed');
            }
            Buffer.from(curve.pointMultiply(senderKey, this.viewPriv)).copy(secret);
        } else {
            throw new Error('Invalid senderKey length');
        }

        prevTxid.copy(secret, 33);
        secret.writeUint32LE(prevVout, 65);
        secret.writeUint32LE(vout, 69);

        const tweak = bitcoin.crypto.sha256(secret);
        if (this.spendPriv) {
            const privateKey = curve.privateAdd(this.spendPriv, tweak);
            return { privateKey: Buffer.from(privateKey), publicKey: Buffer.from(curve.pointFromScalar(privateKey)) };
        } else {
            return { publicKey: Buffer.from(curve.pointAddScalar(this.spendPub, tweak)) };
        }
    }

    static checkOneTimeKey(script: Buffer, publicKey: Buffer): 'p2wpkh' | 'p2tr' | undefined {
        if (script.equals(bitcoin.script.compile([bitcoin.opcodes.OP_1, publicKey.slice(1)]))) {
            return 'p2tr';
        } else if (script.equals(bitcoin.script.compile([bitcoin.opcodes.OP_0, bitcoin.crypto.hash160(publicKey)]))) {
            return 'p2wpkh';
        }
    }

    deriveOneTimeKeys(
        senderKey: Buffer,
        tx: bitcoin.Transaction,
    ): ({ privateKey?: Buffer; publicKey: Buffer; type: 'p2wpkh' | 'p2tr' } | undefined)[] {
        const output = [];

        for (let i = 0; i < tx.outs.length; i++) {
            const k = this.deriveOneTimeKey(senderKey, tx.ins[0].hash, tx.ins[0].index, i);
            const type = StealthAddress.checkOneTimeKey(tx.outs[i].script, k.publicKey);
            output.push(type ? { ...k, type } : undefined);
        }

        return output;
    }

    equals(other: StealthAddress) {
        return this.spendPub.equals(other.spendPub) && this.viewPub.equals(other.viewPub);
    }

    strictEquals(other: StealthAddress) {
        return this.equals(other) && !this.spendPriv == !other.spendPriv && !this.viewPriv == !other.viewPriv;
    }

    toString(): string {
        // subject to change
        if (this.spendPriv) {
            return bs58check.encode(Buffer.concat([Buffer.from([0x35, 0x05, 0x39]), this.spendPriv]));
        } else if (this.viewPriv) {
            const parity = this.spendPub[0] & 1;
            return bs58check.encode(
                Buffer.concat([Buffer.from([0x28, 0x70, 0x42, 0xb0 | parity]), this.spendPub.slice(1), this.viewPriv]),
            );
        } else {
            const parity = ((this.spendPub[0] & 1) << 1) | (this.viewPub[0] & 1);
            return bs58check.encode(
                Buffer.concat([
                    Buffer.from([0x28, 0x6f, 0xba, 0x94 | parity]),
                    this.spendPub.slice(1),
                    this.viewPub.slice(1),
                ]),
            );
        }
    }

    static fromString(s: string) {
        // subject to change
        const data = bs58check.decode(s);
        if (data.length == 35 && data[0] == 0x35 && data[1] == 0x05 && data[2] == 0x39) {
            return new StealthAddress(data.subarray(3, 35));
        } else if (
            data.length == 68 &&
            data[0] == 0x28 &&
            data[1] == 0x70 &&
            data[2] == 0x42 &&
            (data[3] & 0xfe) == 0xb0
        ) {
            const spendPub = Buffer.concat([Buffer.from([data[3] & 1 ? 0x03 : 0x02]), data.subarray(4, 36)]);
            return new StealthAddress(spendPub, data.subarray(36, 68));
        } else if (
            data.length == 68 &&
            data[0] == 0x28 &&
            data[1] == 0x6f &&
            data[2] == 0xba &&
            (data[3] & 0xfc) == 0x94
        ) {
            const spendPub = Buffer.concat([Buffer.from([data[3] & 2 ? 0x03 : 0x02]), data.subarray(4, 36)]);
            const viewPub = Buffer.concat([Buffer.from([data[3] & 1 ? 0x03 : 0x02]), data.subarray(36, 68)]);
            return new StealthAddress(spendPub, viewPub);
        } else {
            throw new Error('Invalid encoding');
        }
    }
}
