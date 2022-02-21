"use strict";
exports.__esModule = true;
exports.merkleRoot = void 0;
var bitcoin = require("bitcoinjs-lib");
var assert_1 = require("assert");
function merkleRoot(txids) {
    var t1 = txids.map(function (txid) {
        if (!Buffer.isBuffer(txid)) {
            txid = Buffer.from(txid, 'hex').reverse();
        }
        (0, assert_1.strict)(txid.length == 32, 'TXID must be 256 bits long');
        return txid;
    });
    while (t1.length > 1) {
        var t2 = [];
        while (t1.length) {
            var ids = t1.splice(0, 2);
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
