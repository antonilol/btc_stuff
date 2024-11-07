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
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathToMerkleRoot = pathToMerkleRoot;
exports.merkleRoot = merkleRoot;
const assert_1 = require("assert");
const bitcoin = __importStar(require("bitcoinjs-lib"));
function pathToMerkleRoot(txids, branch) {
    let t1 = txids.map(txid => {
        if (!Buffer.isBuffer(txid)) {
            txid = Buffer.from(txid, 'hex').reverse();
        }
        (0, assert_1.strict)(txid.length == 32, 'TXID must be 256 bits long');
        return txid;
    });
    let curr = Buffer.isBuffer(branch) ? branch : Buffer.from(branch, 'hex').reverse();
    const path = [];
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
            }
            else if (ids[1].equals(curr)) {
                path.push({ branch: ids[0], action: 'prepend' });
                curr = hash;
            }
            t2.push(hash);
        }
        t1 = t2;
    }
    (0, assert_1.strict)(t1[0].equals(curr), 'branch not in merkle tree');
    path.root = t1[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return path;
}
function merkleRoot(txids) {
    return pathToMerkleRoot(txids, txids[0]).root;
}
