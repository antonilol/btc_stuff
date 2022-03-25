"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var bitcoin = require("bitcoinjs-lib");
var readline_1 = require("readline");
var assert = require("assert");
var bs58 = require("bs58");
// TODO some key derivation, maybe these libs are needed
// import * as curve from 'tiny-secp256k1';
// import ECPairFactory from 'ecpair'
// const ECPair = ECPairFactory(curve);
var rl = (0, readline_1.createInterface)({
    input: process.stdin,
    output: process.stdout
});
var input = function (q) { return new Promise(function (r) { return rl.question(q, r); }); };
var pad = function (s, len) { return s + ' '.repeat(len - s.length); };
var color = function () {
    var colors = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        colors[_i] = arguments[_i];
    }
    return colors.length ? "\u001B[".concat(colors.join(';'), "m") : '';
};
var RESET = 0, BOLD = 1, REVERSED = 7, RED = 31, CYAN = 36;
var versions = [
    { network: 'mainnet', version: Buffer.from('0488b21e', 'hex'), private: false, script: 'p2pkh or p2sh' },
    { network: 'mainnet', version: Buffer.from('0488ade4', 'hex'), private: true, script: 'p2pkh or p2sh' },
    { network: 'mainnet', version: Buffer.from('049d7cb2', 'hex'), private: false, script: 'p2wpkh-p2sh' },
    { network: 'mainnet', version: Buffer.from('049d7878', 'hex'), private: true, script: 'p2wpkh-p2sh' },
    { network: 'mainnet', version: Buffer.from('0295b43f', 'hex'), private: false, script: 'p2wsh-p2sh' },
    { network: 'mainnet', version: Buffer.from('0295b005', 'hex'), private: true, script: 'p2wsh-p2sh' },
    { network: 'mainnet', version: Buffer.from('04b24746', 'hex'), private: false, script: 'p2wpkh' },
    { network: 'mainnet', version: Buffer.from('04b2430c', 'hex'), private: true, script: 'p2wpkh' },
    { network: 'mainnet', version: Buffer.from('02aa7ed3', 'hex'), private: false, script: 'p2wsh' },
    { network: 'mainnet', version: Buffer.from('02aa7a99', 'hex'), private: true, script: 'p2wsh' },
    { network: 'testnet', version: Buffer.from('043587cf', 'hex'), private: false, script: 'p2pkh or p2sh' },
    { network: 'testnet', version: Buffer.from('04358394', 'hex'), private: true, script: 'p2pkh or p2sh' },
    { network: 'testnet', version: Buffer.from('044a5262', 'hex'), private: false, script: 'p2wpkh-p2sh' },
    { network: 'testnet', version: Buffer.from('044a4e28', 'hex'), private: true, script: 'p2wpkh-p2sh' },
    { network: 'testnet', version: Buffer.from('024289ef', 'hex'), private: false, script: 'p2wsh-p2sh' },
    { network: 'testnet', version: Buffer.from('024285b5', 'hex'), private: true, script: 'p2wsh-p2sh' },
    { network: 'testnet', version: Buffer.from('045f1cf6', 'hex'), private: false, script: 'p2wpkh' },
    { network: 'testnet', version: Buffer.from('045f18bc', 'hex'), private: true, script: 'p2wpkh' },
    { network: 'testnet', version: Buffer.from('02575483', 'hex'), private: false, script: 'p2wsh' },
    { network: 'testnet', version: Buffer.from('02575048', 'hex'), private: true, script: 'p2wsh' }
];
main();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.argv.length > 2)) return [3 /*break*/, 1];
                    i = process.argv[2];
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, input('Enter seed, xpriv or xpub\n> ')];
                case 2:
                    i = _a.sent();
                    _a.label = 3;
                case 3:
                    // try extended key
                    try {
                        displayExtKey(i);
                    }
                    catch (e) {
                    }
                    // try seed
                    // const words = i.split(' ');
                    // ...
                    console.error('Seed functionality not implemented yet');
                    process.exit(38);
                    return [2 /*return*/];
            }
        });
    });
}
function displayExtKey(i) {
    var k = Buffer.from(bs58.decode(i));
    assert(k.length == 82);
    if (bitcoin.crypto.hash256(k.slice(0, 78)).compare(k, 78, 82, 0, 4)) {
        console.log(color(BOLD, RED) + 'Warning: Invalid checksum' + color(RESET));
    }
    var ver = k.slice(0, 4);
    var depth = k.readUInt8(4);
    var fingerprint = k.slice(5, 9);
    var n = k.readUInt32BE(9);
    var chain = k.slice(13, 45);
    var key = k.slice(45, 78);
    console.log("\nVersion:            ".concat(ver.toString('hex'), "\nDepth:              ").concat(depth, "\nMaster fingerprint: ").concat(fingerprint.toString('hex'), "\nChild number:       ").concat(n & 0x7fffffff).concat(n & 0x80000000 ? "'" : '', "\nChain code:         ").concat(chain.toString('hex'), "\nKey:                ").concat((key[0] ? key : key.slice(1)).toString('hex')));
    var type = versions.find(function (v) { return !v.version.compare(ver); });
    if (type) {
        console.log("\nNetwork:            ".concat(type.network, "\nKey type:           ").concat(type.private ? 'private' : 'public', "\nScript type:        ").concat(type.script));
    }
    console.log("\nAll Electrum defined master key versions:\nNetwork     Key type     Script type     Key");
    versions.forEach(function (v, i) {
        v.version.copy(k);
        bitcoin.crypto.hash256(k.slice(0, 78)).copy(k, 78, 0, 4);
        var colors = [];
        if (i & 1) {
            colors.push(REVERSED);
        }
        if (v == type) {
            colors.push(BOLD, CYAN);
        }
        console.log(color.apply(void 0, colors) +
            pad(v.network, 12) +
            pad(v.private ? 'private' : 'public', 13) +
            pad(v.script, 15) +
            bs58.encode(k) +
            color(RESET));
    });
    process.exit(0);
}
