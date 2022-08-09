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
var btc_1 = require("./btc");
var bitcoin = require("bitcoinjs-lib");
var assert = require("assert");
var bs58 = require("bs58");
var bip32_1 = require("bip32");
var curve = require("tiny-secp256k1");
var bip32 = (0, bip32_1["default"])(curve);
var pad = function (s, len) { return s + ' '.repeat(len - s.length); };
var color = function () {
    var colors = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        colors[_i] = arguments[_i];
    }
    return (colors.length ? "\u001B[".concat(colors.join(';'), "m") : '');
};
var checksum = function (key) { return bitcoin.crypto.hash256(key.slice(0, 78)).copy(key, 78, 0, 4); };
var RESET = 0;
var BOLD = 1;
var REVERSED = 7;
var RED = 31;
var CYAN = 36;
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
var i, k, ver, depth, fingerprint, n, chain, key, type, bip32key;
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!true) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, btc_1.input)("\nEnter master/extended key to load or a command".concat(i ? '' : " (type 'help' for a list of commands)", "\n> "))];
                case 1:
                    i = _a.sent();
                    if (!i) {
                        return [3 /*break*/, 0];
                    }
                    args = i.split(' ');
                    if (args[0] == 'help') {
                        console.log("\nCommands:\n\thelp: show this list\n\texit: exit\n\tload <key>: loads a key\n\tderive <path>: derive the loaded key to a new one. loads the new one\n\tinfo: displays information about the loaded key");
                    }
                    else if (args[0] == 'exit') {
                        process.exit(0);
                    }
                    else if (args[0] == 'load') {
                        if (args.length > 1) {
                            if (readKey(args[1])) {
                                console.log('Key loaded');
                            }
                        }
                        else {
                            console.log('load requires an argument <key>');
                        }
                    }
                    else if (args[0] == 'derive') {
                        if (args.length > 1) {
                            if (derive(args[1])) {
                                console.log("New key loaded: ".concat(bs58.encode(k)));
                            }
                        }
                        else {
                            console.log('derive requires an argument <path>');
                        }
                    }
                    else if (args[0] == 'info') {
                        displayKey();
                    }
                    else {
                        if (readKey(args[0])) {
                            console.log('Key loaded');
                        }
                    }
                    return [3 /*break*/, 0];
                case 2: return [2 /*return*/];
            }
        });
    });
}
function derive(path) {
    try {
        bip32key = bip32key.derivePath(path);
    }
    catch (e) {
        console.log(e.message);
        return false;
    }
    readKey(bip32key.toBase58(), true);
    return true;
}
function loadKey(s) {
    try {
        k = Buffer.from(bs58.decode(s));
        assert(k.length == 82);
    }
    catch (e) {
        console.log('Invalid input');
        k = undefined;
        return false;
    }
    if (bitcoin.crypto.hash256(k.slice(0, 78)).compare(k, 78, 82, 0, 4)) {
        console.log(color(BOLD, RED) + 'Error: Invalid checksum' + color(RESET));
        checksum(k);
        console.log('Key with recalculated checksum (only use if you know what you are doing!):\n' + bs58.encode(k));
        k = undefined;
        return false;
    }
    return true;
}
function readKey(s, useOldVersion) {
    if (useOldVersion === void 0) { useOldVersion = false; }
    if (!loadKey(s)) {
        return false;
    }
    if (useOldVersion) {
        ver.copy(k);
        checksum(k);
    }
    else {
        ver = k.slice(0, 4);
    }
    depth = k.readUInt8(4);
    fingerprint = k.slice(5, 9);
    n = k.readUInt32BE(9);
    chain = k.slice(13, 45);
    key = k.slice(45, 78);
    type = versions.find(function (v) { return !v.version.compare(ver); });
    if (!type) {
        console.log("Invalid version: 0x".concat(ver.toString('hex')));
        return false;
    }
    if (!useOldVersion) {
        var clone = Buffer.allocUnsafe(82);
        k.copy(clone, 4, 4, 78);
        versions.find(function (v) { return v.private == type.private && v.network == type.network; }).version.copy(clone);
        checksum(clone);
        bip32key = bip32.fromBase58(bs58.encode(clone), type.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet);
    }
    return true;
}
function displayKey() {
    if (!k) {
        console.log('No key loaded');
        return;
    }
    console.log("\nVersion:              ".concat(ver.toString('hex'), "\nDepth:                ").concat(depth, "\nMaster fingerprint:   ").concat(fingerprint.toString('hex'), "\nChild number:         ").concat(n & 0x7fffffff).concat(n & 0x80000000 ? "'" : '', "\nChain code:           ").concat(chain.toString('hex'), "\nKey:                  ").concat((key[0] ? key : key.slice(1)).toString('hex'), "\n\nNetwork:              ").concat(type.network, "\nKey type:             ").concat(type.private ? 'private' : 'public', "\nElectrum script type: ").concat(type.script, "\n\nAll Electrum defined master key versions:\nNetwork     Key type     Script type     Key"));
    versions
        .filter(function (v) { return v.private == type.private; })
        .forEach(function (v, i) {
        v.version.copy(k);
        checksum(k);
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
}
