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
exports.setChain = exports.decodeRawTransaction = exports.getBlockTemplate = exports.bech32toScriptPubKey = exports.getnewaddress = exports.listunspent = exports.send = exports.newtx = exports.btc = void 0;
var child_process_1 = require("child_process");
var bitcoin = require("bitcoinjs-lib");
var chain = 'test';
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
                        if (Buffer.isBuffer(x)) {
                            return x.toString('hex');
                        }
                        if (typeof x === 'object') {
                            return JSON.stringify(x);
                        }
                        return x.toString().replace(/\n/g, '');
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
function bech32toScriptPubKey(a) {
    var z = bitcoin.address.fromBech32(a);
    return bitcoin.script.compile([
        bitcoin.script.number.encode(z.version),
        bitcoin.address.fromBech32(a).data
    ]);
}
exports.bech32toScriptPubKey = bech32toScriptPubKey;
function getBlockTemplate(template_request) {
    if (template_request === void 0) { template_request = { rules: ['segwit'] }; }
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, btc('getblocktemplate', template_request)];
                case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
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
function setChain(c) {
    chain = c;
}
exports.setChain = setChain;
