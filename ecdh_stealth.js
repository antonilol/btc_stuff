"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StealthAddress = void 0;
const curve = __importStar(require("tiny-secp256k1"));
const bitcoin = __importStar(require("bitcoinjs-lib"));
const bs58check_1 = __importDefault(require("bs58check"));
class StealthAddress {
    constructor(spendKey, viewKey) {
        if (spendKey.length == 32) {
            this.spendPriv = spendKey;
        }
        else if (spendKey.length == 33) {
            if (viewKey.length == 32) {
                this.viewPriv = viewKey;
            }
            else if (viewKey.length == 33) {
                this.viewPub = viewKey;
            }
            else {
                throw new Error('Invalid viewKey length');
            }
            this.spendPub = spendKey;
        }
        else {
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
    /** When sending from a taproot address, add '02' in front of the senderKey */
    deriveOneTimeKey(senderKey, prevTxid, prevVout, vout) {
        // 33 bytes ecdh shared secret, 32 bytes uint256le prevTxid, 4 bytes uint32le prevVout, 4 bytes uint32le vout
        const secret = Buffer.allocUnsafe(73);
        if (senderKey.length == 32) {
            Buffer.from(curve.pointMultiply(this.viewPub, senderKey)).copy(secret);
        }
        else if (senderKey.length == 33) {
            if (!this.viewPriv) {
                throw new Error('Private view key is needed');
            }
            Buffer.from(curve.pointMultiply(senderKey, this.viewPriv)).copy(secret);
        }
        else {
            throw new Error('Invalid senderKey length');
        }
        prevTxid.copy(secret, 33);
        secret.writeUint32LE(prevVout, 65);
        secret.writeUint32LE(vout, 69);
        const tweak = bitcoin.crypto.sha256(secret);
        if (this.spendPriv) {
            const privateKey = curve.privateAdd(this.spendPriv, tweak);
            return { privateKey: Buffer.from(privateKey), publicKey: Buffer.from(curve.pointFromScalar(privateKey)) };
        }
        else {
            return { publicKey: Buffer.from(curve.pointAddScalar(this.spendPub, tweak)) };
        }
    }
    static checkOneTimeKey(script, publicKey) {
        if (script.equals(bitcoin.script.compile([bitcoin.opcodes.OP_1, publicKey.slice(1)]))) {
            return 'p2tr';
        }
        else if (script.equals(bitcoin.script.compile([bitcoin.opcodes.OP_0, bitcoin.crypto.hash160(publicKey)]))) {
            return 'p2wpkh';
        }
    }
    deriveOneTimeKeys(senderKey, tx) {
        const output = [];
        for (let i = 0; i < tx.outs.length; i++) {
            const k = this.deriveOneTimeKey(senderKey, tx.ins[0].hash, tx.ins[0].index, i);
            const type = StealthAddress.checkOneTimeKey(tx.outs[i].script, k.publicKey);
            output.push(type ? { ...k, type } : undefined);
        }
        return output;
    }
    equals(other) {
        return this.spendPub.equals(other.spendPub) && this.viewPub.equals(other.viewPub);
    }
    strictEquals(other) {
        return this.equals(other) && !this.spendPriv == !other.spendPriv && !this.viewPriv == !other.viewPriv;
    }
    toString() {
        // subject to change
        if (this.spendPriv) {
            return bs58check_1.default.encode(Buffer.concat([Buffer.from([0x35, 0x05, 0x39]), this.spendPriv]));
        }
        else if (this.viewPriv) {
            const parity = this.spendPub[0] & 1;
            return bs58check_1.default.encode(Buffer.concat([Buffer.from([0x28, 0x70, 0x42, 0xb0 | parity]), this.spendPub.slice(1), this.viewPriv]));
        }
        else {
            const parity = ((this.spendPub[0] & 1) << 1) | (this.viewPub[0] & 1);
            return bs58check_1.default.encode(Buffer.concat([Buffer.from([0x28, 0x6f, 0xba, 0x94 | parity]), this.spendPub.slice(1), this.viewPub.slice(1)]));
        }
    }
    static fromString(s) {
        // subject to change
        const data = bs58check_1.default.decode(s);
        if (data.length == 35 && data[0] == 0x35 && data[1] == 0x05 && data[2] == 0x39) {
            return new StealthAddress(data.subarray(3, 35));
        }
        else if (data.length == 68 && data[0] == 0x28 && data[1] == 0x70 && data[2] == 0x42 && (data[3] & 0xfe) == 0xb0) {
            const spendPub = Buffer.concat([Buffer.from([data[3] & 1 ? 0x03 : 0x02]), data.subarray(4, 36)]);
            return new StealthAddress(spendPub, data.subarray(36, 68));
        }
        else if (data.length == 68 && data[0] == 0x28 && data[1] == 0x6f && data[2] == 0xba && (data[3] & 0xfc) == 0x94) {
            const spendPub = Buffer.concat([Buffer.from([data[3] & 2 ? 0x03 : 0x02]), data.subarray(4, 36)]);
            const viewPub = Buffer.concat([Buffer.from([data[3] & 1 ? 0x03 : 0x02]), data.subarray(36, 68)]);
            return new StealthAddress(spendPub, viewPub);
        }
        else {
            throw new Error('Invalid encoding');
        }
    }
}
exports.StealthAddress = StealthAddress;
