"use strict";
// original file: test/functional/test_framework/descriptors.py at 2d83a20113c109f3325316c42540b3f23ce18bc7
// only contains descsum_create and dependencies
// Copyright (c) 2019 Pieter Wuille
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.
Object.defineProperty(exports, "__esModule", { value: true });
exports.descsumCreate = descsumCreate;
// Utility functions related to output descriptors
const INPUT_CHARSET = '0123456789()[],\'/*abcdefgh@:$%{}IJKLMNOPQRSTUVWXYZ&+-.;<=>?!^_|~ijklmnopqrstuvwxyzABCDEFGH`#"\\ ';
const CHECKSUM_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0xf5dee51989n, 0xa9fdca3312n, 0x1bab10e32dn, 0x3706b1677an, 0x644d626ffdn];
/** Internal function that computes the descriptor checksum. */
function descsumPolymod(symbols) {
    let chk = 1n;
    for (const value of symbols) {
        const top = chk >> 35n;
        chk = ((chk & 0x7ffffffffn) << 5n) ^ BigInt(value);
        for (let i = 0; i < 5; i++) {
            chk ^= (top >> BigInt(i)) & 1n ? GENERATOR[i] : 0n;
        }
    }
    return chk;
}
/** Internal function that does the character to symbol expansion */
function descsumExpand(s) {
    let groups = [];
    const symbols = [];
    for (const c of s.split('')) {
        if (!INPUT_CHARSET.includes(c)) {
            return;
        }
        const v = INPUT_CHARSET.indexOf(c);
        symbols.push(v & 31);
        groups.push(v >> 5);
        if (groups.length === 3) {
            symbols.push(groups[0] * 9 + groups[1] * 3 + groups[2]);
            groups = [];
        }
    }
    if (groups.length === 1) {
        symbols.push(groups[0]);
    }
    else if (groups.length === 2) {
        symbols.push(groups[0] * 3 + groups[1]);
    }
    return symbols;
}
/** Add a checksum to a descriptor without */
function descsumCreate(s) {
    const symbols = descsumExpand(s).concat(0, 0, 0, 0, 0, 0, 0, 0);
    const checksum = descsumPolymod(symbols) ^ 1n;
    let c = s + '#';
    for (let i = 0n; i < 8n; i++) {
        c += CHECKSUM_CHARSET[Number((checksum >> (5n * (7n - i))) & 31n)];
    }
    return c;
}
