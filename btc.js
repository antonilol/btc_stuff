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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.consoleTrace = exports.input = exports.toBTC = exports.toSat = exports.txidToString = exports.cloneBuf = exports.bech32toScriptPubKey = exports.insertTransaction = exports.removeTransaction = exports.setChain = exports.createTaprootOutput = exports.tapTweak = exports.tapBranch = exports.tapLeaf = exports.randomInternalKey = exports.OP_CHECKSIGADD = exports.fundAddress = exports.getTXOut = exports.decodeRawTransaction = exports.getBlockTemplate = exports.getnewaddress = exports.listunspent = exports.send = exports.newtx = exports.btc = exports.networks = void 0;
var child_process_1 = require("child_process");
var bitcoin = require("bitcoinjs-lib");
var readline_1 = require("readline");
var curve = require("tiny-secp256k1");
var ecpair_1 = require("ecpair");
var ZERO = Buffer.alloc(32);
var ONE = Buffer.from(ZERO.map(function (_, i) { return i == 31 ? 1 : 0; }));
var TWO = Buffer.from(ZERO.map(function (_, i) { return i == 31 ? 2 : 0; }));
var N_LESS_1 = Buffer.from(curve.privateSub(ONE, TWO));
var ECPair = (0, ecpair_1.ECPairFactory)(curve);
exports.networks = {
    main: bitcoin.networks.bitcoin,
    test: bitcoin.networks.testnet,
    regtest: bitcoin.networks.regtest,
    signet: bitcoin.networks.testnet
};
var chain = 'test';
var network = exports.networks[chain];
function btc() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (r, e) {
                    var cmdargs = ["-chain=".concat(chain), '-stdin'];
                    while (args.length &&
                        typeof args[0] === 'string' &&
                        args[0].startsWith('-')) {
                        cmdargs.push(args.shift());
                    }
                    var p = (0, child_process_1.spawn)('bitcoin-cli', cmdargs);
                    var out = '';
                    p.stdout.setEncoding('utf8');
                    p.stdout.on('data', function (data) { return out += data.toString(); });
                    p.stderr.setEncoding('utf8');
                    p.stderr.on('data', function (data) { return out += data.toString(); });
                    p.on('close', function (code) {
                        while (out.endsWith('\n')) {
                            out = out.slice(0, -1);
                        }
                        (code ? e : r)(out);
                    });
                    p.stdin.write(args.map(function (x) {
                        var arg;
                        if (Buffer.isBuffer(x)) {
                            arg = x.toString('hex');
                        }
                        else if (typeof x === 'number') {
                            arg = x.toString();
                        }
                        else if (typeof x === 'string') {
                            arg = x;
                        }
                        else {
                            arg = JSON.stringify(x);
                        }
                        return arg.replace(/\n/g, '');
                    }).join('\n'));
                    p.stdin.end();
                })];
        });
    });
}
exports.btc = btc;
// sign, create and send new transaction
function newtx(inputs, outputs, sat) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, signed, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (sat) {
                        Object.keys(outputs).forEach(function (k) {
                            outputs[k] = parseFloat((outputs[k] * 1e-8).toFixed(8));
                        });
                    }
                    return [4 /*yield*/, btc('createrawtransaction', inputs, outputs)];
                case 1:
                    tx = _c.sent();
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, btc('signrawtransactionwithwallet', tx)];
                case 2:
                    signed = _b.apply(_a, [_c.sent()]).hex;
                    return [2 /*return*/, send(signed)];
            }
        });
    });
}
exports.newtx = newtx;
function send(hex) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, btc('sendrawtransaction', hex)];
        });
    });
}
exports.send = send;
function listunspent(minamount, minconf, sat) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, btc('-named', 'listunspent', 'minconf=' + minconf, "query_options={\"minimumAmount\":".concat(minamount, "}"))];
                case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()]).map(function (u) {
                        if (sat) {
                            u.amount = Math.round(u.amount * 1e8);
                        }
                        return u;
                    })];
            }
        });
    });
}
exports.listunspent = listunspent;
function getnewaddress() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, btc('getnewaddress')];
        });
    });
}
exports.getnewaddress = getnewaddress;
function getBlockTemplate(template_request) {
    if (template_request === void 0) { template_request = { rules: ['segwit'] }; }
    return __awaiter(this, void 0, void 0, function () {
        var template, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, btc('getblocktemplate', template_request)];
                case 1:
                    template = _b.apply(_a, [_c.sent()]);
                    updateTXDepends(template);
                    return [2 /*return*/, template];
            }
        });
    });
}
exports.getBlockTemplate = getBlockTemplate;
function decodeRawTransaction(txHex) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, btc('decoderawtransaction', txHex)];
                case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
            }
        });
    });
}
exports.decodeRawTransaction = decodeRawTransaction;
function getTXOut(txid, vout, include_mempool) {
    if (include_mempool === void 0) { include_mempool = true; }
    return __awaiter(this, void 0, void 0, function () {
        var txout;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, btc('gettxout', txidToString(txid), vout, include_mempool)];
                case 1:
                    txout = _a.sent();
                    if (txout) {
                        return [2 /*return*/, JSON.parse(txout)];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
exports.getTXOut = getTXOut;
// export function fundScript(scriptPubKey: Buffer, amount: number): Promise<UTXO | undefined> { /* TODO */ }
function fundAddress(address, amount) {
    return __awaiter(this, void 0, void 0, function () {
        var txid, vout, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, btc('sendtoaddress', address, toBTC(amount))];
                case 1:
                    txid = _c.sent();
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, btc('gettransaction', txid)];
                case 2:
                    vout = _b.apply(_a, [_c.sent()]).details.find(function (x) { return x.address == address; }).vout;
                    return [2 /*return*/, { txid: txid, vout: vout }];
            }
        });
    });
}
exports.fundAddress = fundAddress;
exports.OP_CHECKSIGADD = 0xba; // this is not merged yet: https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742
function randomInternalKey(options) {
    var keypair = ECPair.makeRandom(options);
    if (keypair.publicKey[0] == 3) {
        return ECPair.fromPrivateKey(Buffer.from(curve.privateAdd(curve.privateSub(N_LESS_1, keypair.privateKey), ONE)), options);
    }
    return keypair;
}
exports.randomInternalKey = randomInternalKey;
function tapLeaf(script) {
    return bitcoin.crypto.taggedHash('TapLeaf', Buffer.concat([Buffer.from([0xc0, script.length]), script]));
}
exports.tapLeaf = tapLeaf;
function tapBranch(branch1, branch2) {
    return bitcoin.crypto.taggedHash('TapBranch', Buffer.concat(branch1 < branch2 ? [branch1, branch2] : [branch2, branch1]));
}
exports.tapBranch = tapBranch;
function tapTweak(pubkey, branch) {
    return bitcoin.crypto.taggedHash('TapTweak', Buffer.concat([pubkey.slice(-32), branch]));
}
exports.tapTweak = tapTweak;
function createTaprootOutput(publicKey, tweak) {
    var tweaked = curve.pointAddScalar(publicKey, tweak);
    return { parity: (tweaked[0] & 1), key: Buffer.from(tweaked).slice(-32) };
}
exports.createTaprootOutput = createTaprootOutput;
function setChain(c) {
    chain = c;
    network = exports.networks[chain];
}
exports.setChain = setChain;
// Utils
// remove a transaction from a templateFile
// removes all dependendencies
// subtracts fee of removed transactions from coinbasevalue
// returns all removed transactions
function removeTransaction(template, txid) {
    var txs = template.transactions;
    var tx = txs.find(function (x) { return x.txid == txid; });
    if (!tx) {
        return [];
    }
    var toRemove = [tx];
    var removed = [];
    while (toRemove.length) {
        var tx_1 = toRemove.shift();
        toRemove.push.apply(toRemove, tx_1.TXdepends);
        removed.push.apply(removed, txs.splice(txs.indexOf(tx_1), 1));
    }
    template.coinbasevalue -= removed.reduce(function (v, x) { return v + x.fee; }, 0);
    updateNumberDepends(template);
    return removed;
}
exports.removeTransaction = removeTransaction;
function insertTransaction(template, data) {
    return __awaiter(this, void 0, void 0, function () {
        var rawtx, tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, decodeRawTransaction(data)];
                case 1:
                    rawtx = _a.sent();
                    if (template.transactions.find(function (x) { return x.txid == rawtx.txid; })) {
                        return [2 /*return*/, false];
                    }
                    tx = {
                        data: Buffer.isBuffer(data) ? data.toString('hex') : data,
                        txid: rawtx.txid,
                        hash: rawtx.hash,
                        depends: [],
                        TXdepends: template.transactions.filter(function (x) { return rawtx.vin.map(function (y) { return y.txid; }).includes(x.txid); }),
                        weight: rawtx.weight
                    };
                    template.transactions.push(tx);
                    updateNumberDepends(template);
                    return [2 /*return*/, true];
            }
        });
    });
}
exports.insertTransaction = insertTransaction;
function updateTXDepends(template) {
    for (var _i = 0, _a = template.transactions; _i < _a.length; _i++) {
        var tx = _a[_i];
        tx.TXdepends = tx.depends.map(function (i) { return template.transactions[i - 1]; });
    }
}
function updateNumberDepends(template) {
    for (var _i = 0, _a = template.transactions; _i < _a.length; _i++) {
        var tx = _a[_i];
        tx.depends = tx.TXdepends.map(function (tx) { return template.transactions.indexOf(tx) + 1; });
    }
}
function bech32toScriptPubKey(a) {
    var z = bitcoin.address.fromBech32(a);
    return bitcoin.script.compile([
        bitcoin.script.number.encode(z.version),
        bitcoin.address.fromBech32(a).data
    ]);
}
exports.bech32toScriptPubKey = bech32toScriptPubKey;
function cloneBuf(buf) {
    return Uint8Array.prototype.slice.call(buf);
}
exports.cloneBuf = cloneBuf;
function txidToString(txid) {
    if (typeof txid === 'string') {
        return txid;
    }
    return cloneBuf(txid).reverse().toString('hex');
}
exports.txidToString = txidToString;
function toSat(BTC) {
    // prevent floating point quirks: 4.24524546 * 1e8 = 424524545.99999994
    return Math.round(BTC * 1e8);
}
exports.toSat = toSat;
function toBTC(sat) {
    // prevent floating point quirks: 424524546 * 1e-8 = 4.2452454600000005
    return parseFloat((sat * 1e-8).toFixed(8));
}
exports.toBTC = toBTC;
function input(q) {
    var rl = (0, readline_1.createInterface)({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(function (r) { return rl.question(q, function (a) {
        r(a);
        rl.close();
    }); });
}
exports.input = input;
// from https://stackoverflow.com/a/47296370/13800918, edited
exports.consoleTrace = Object.fromEntries(['log', 'warn', 'error'].map(function (methodName) {
    return [
        methodName,
        function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var initiator = 'unknown place';
            try {
                throw new Error();
            }
            catch (e) {
                if (typeof e.stack === 'string') {
                    var isFirst = true;
                    for (var _a = 0, _b = e.stack.split('\n'); _a < _b.length; _a++) {
                        var line = _b[_a];
                        var matches = line.match(/^\s+at\s+(.*)/);
                        if (matches) {
                            if (!isFirst) { // first line - current function
                                // second line - caller (what we are looking for)
                                initiator = matches[1];
                                break;
                            }
                            isFirst = false;
                        }
                    }
                }
            }
            console[methodName].apply(console, __spreadArray(__spreadArray([], args, false), ['\n', "  at ".concat(initiator)], false));
        }
    ];
}));
