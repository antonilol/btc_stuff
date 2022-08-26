"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.merkleRoot = void 0;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const assert_1 = require("assert");
function merkleRoot(txids) {
    let t1 = txids.map(txid => {
        if (!Buffer.isBuffer(txid)) {
            txid = Buffer.from(txid, 'hex').reverse();
        }
        (0, assert_1.strict)(txid.length == 32, 'TXID must be 256 bits long');
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
exports.merkleRoot = merkleRoot;
