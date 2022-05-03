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
var child_process_1 = require("child_process");
var bitcoin = require("bitcoinjs-lib");
var btc_1 = require("./btc");
var merkle_tree_1 = require("./merkle_tree");
var assert_1 = require("assert");
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var path_1 = require("path");
var curve = require("tiny-secp256k1");
var ecpair_1 = require("ecpair");
var ECPair = (0, ecpair_1.ECPairFactory)(curve);
var minerd = "".concat((0, path_1.dirname)(process.argv[1]), "/cpuminer/minerd");
// set to false to remove all segwit txs and skip witness commitment
var segwit = true;
// set to true to sign blocks according to BIP325
var signet = false;
if (signet) {
    (0, btc_1.setChain)('signet');
}
// i say DONT CHEAT it is only here for me :)
var cheat = false;
var args = process.argv.slice(2);
var blocks = -1;
if (args.length > 0) {
    blocks = parseInt(args[0]);
    if (blocks === 0) {
        process.exit(0);
    }
    if (!blocks || blocks < -1) {
        console.log('Provide a positive integer or -1 for block limit');
        process.exit(1);
    }
}
if (args.length > 1) {
    templateFile = args[1];
    if (templateFile) {
        console.log("Using block template from ".concat(templateFile));
    }
}
function encodeVarUIntLE(n) {
    (0, assert_1.strict)(n >= 0 && n < Math.pow(2, 32));
    var l = 1;
    var b = '8';
    var off = 0;
    var i;
    if (n > 0xffff) {
        l = 5;
        b = '32LE';
        off = 1;
        i = 0xfe;
    }
    else if (n > 0xfc) {
        l = 3;
        b = '16LE';
        off = 1;
        i = 0xfd;
    }
    var buf = Buffer.allocUnsafe(l);
    buf["writeUInt".concat(b)](n, off);
    if (off) {
        buf.writeUInt8(i);
    }
    return buf;
}
var templateFile;
// BIP141
var wCommitHeader = Buffer.from('aa21a9ed', 'hex');
// BIP325
var signetHeader = Buffer.from('ecc7daa2', 'hex');
function createCoinbase(address, value, height, txs, message, extraNonce, signetBlockSig) {
    var tx = new bitcoin.Transaction();
    // in
    tx.addInput(Buffer.alloc(32), 0xffffffff);
    tx.setInputScript(0, Buffer.concat([
        bitcoin.script.compile([bitcoin.script.number.encode(height)]),
        extraNonce,
        Buffer.from(message)
    ]));
    // block reward + fees
    tx.addOutput((0, btc_1.bech32toScriptPubKey)(address), value);
    var commits = [];
    if (segwit) {
        // witness commitment
        var wtxids = txs.map(function (x) { return x.hash; });
        wtxids.splice(0, 0, Buffer.alloc(32));
        commits.push(Buffer.concat([
            wCommitHeader,
            bitcoin.crypto.hash256(Buffer.concat([
                (0, merkle_tree_1.merkleRoot)(wtxids),
                Buffer.alloc(32)
            ]))
        ]));
        tx.setWitness(0, [Buffer.alloc(32)]);
    }
    if (signet) {
        // signet block signature
        commits.push(Buffer.concat([
            signetHeader,
            signetBlockSig ? signetBlockSig : Buffer.alloc(0)
        ]));
    }
    if (commits.length) {
        tx.addOutput(bitcoin.script.compile(__spreadArray([
            bitcoin.opcodes.OP_RETURN
        ], commits, true)), 0);
    }
    // serialize
    var coinbase = tx.toBuffer();
    var txid = tx.getId();
    return { tx: coinbase, txid: txid };
}
function getWork() {
    return __awaiter(this, void 0, void 0, function () {
        var t, req, time, prev, txs, mempool, _i, _a, tx, toRemove, removed, txcount, message, address, extraNonce, signetBlockSig, _loop_1, txlen, o, state_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!templateFile) return [3 /*break*/, 1];
                    t = JSON.parse((0, fs_1.readFileSync)(templateFile).toString());
                    return [3 /*break*/, 3];
                case 1:
                    req = { rules: ['segwit'] };
                    if (signet) {
                        req.rules.push('signet');
                    }
                    return [4 /*yield*/, (0, btc_1.getBlockTemplate)(req)];
                case 2:
                    t = _b.sent();
                    _b.label = 3;
                case 3:
                    if (!cheat) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, btc_1.btc)('getblockheader', t.previousblockhash)];
                case 4:
                    prev = _b.sent();
                    time = JSON.parse(prev).time + 20 * 60 + 1;
                    return [3 /*break*/, 6];
                case 5:
                    time = Math.floor(new Date().getTime() / 1000);
                    _b.label = 6;
                case 6:
                    txs = t.transactions;
                    mempool = (0, fs_1.readdirSync)('mempool');
                    _i = 0, _a = mempool.map(function (f) { return (0, fs_1.readFileSync)("mempool/".concat(f)).toString().trim(); });
                    _b.label = 7;
                case 7:
                    if (!(_i < _a.length)) return [3 /*break*/, 10];
                    tx = _a[_i];
                    return [4 /*yield*/, (0, btc_1.insertTransaction)(t, tx)];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10:
                    if (!segwit) {
                        removed = 0;
                        while (toRemove = t.transactions.find(function (x) { return x.hash != x.txid; })) {
                            removed += (0, btc_1.removeTransaction)(t, toRemove.txid).length;
                        }
                        console.log("SegWit is disabled");
                        console.log("Excluded ".concat(removed, " SegWit transactions from the block"));
                    }
                    txcount = encodeVarUIntLE(txs.length + 1);
                    message = ' github.com/antonilol/btc_stuff >> New signet miner! << ';
                    address = 'tb1qllllllxl536racn7h9pew8gae7tyu7d58tgkr3';
                    if (!address) {
                        btc_1.consoleTrace.error('No payout address specified!');
                        process.exit(1);
                    }
                    extraNonce = (0, crypto_1.randomBytes)(4);
                    _loop_1 = function () {
                        var coinbase, txoffset, block, mRoot, sighash, scriptSig, _c, _d, _e, _f, _g, _h, scriptWitness;
                        return __generator(this, function (_j) {
                            switch (_j.label) {
                                case 0:
                                    coinbase = createCoinbase(address, t.coinbasevalue, t.height, txs, message, extraNonce, signetBlockSig);
                                    txlen = coinbase.tx.length;
                                    txs.forEach(function (tx) {
                                        txlen += tx.data.length / 2;
                                    });
                                    txoffset = 80 + txcount.length;
                                    block = Buffer.allocUnsafe(txoffset + txlen);
                                    txcount.copy(block, 80);
                                    coinbase.tx.copy(block, txoffset);
                                    o = txoffset + coinbase.tx.length;
                                    txs.forEach(function (tx) {
                                        var data = Buffer.from(tx.data, 'hex');
                                        data.copy(block, o);
                                        o += data.length;
                                    });
                                    mRoot = (0, merkle_tree_1.merkleRoot)(__spreadArray([coinbase.txid], txs.map(function (x) { return x.txid; }), true));
                                    block.writeUInt32LE(t.version);
                                    Buffer.from(t.previousblockhash, 'hex').reverse().copy(block, 4);
                                    mRoot.copy(block, 36);
                                    block.writeUInt32LE(time, 68);
                                    Buffer.from(cheat ? '1d00ffff' : t.bits, 'hex').reverse().copy(block, 72);
                                    if (!signet || signetBlockSig) {
                                        return [2 /*return*/, { value: { block: block, mempool: mempool } }];
                                    }
                                    sighash = signetBlockSighash(block.slice(0, 72), Buffer.from(t.signet_challenge, 'hex')).legacy;
                                    _d = (_c = bitcoin.script).compile;
                                    _f = (_e = bitcoin.script.signature).encode;
                                    _h = (_g = ECPair).fromWIF;
                                    return [4 /*yield*/, (0, btc_1.btc)('dumpprivkey', 'tb1qllllllxl536racn7h9pew8gae7tyu7d58tgkr3')];
                                case 1:
                                    scriptSig = _d.apply(_c, [[
                                            _f.apply(_e, [_h.apply(_g, [_j.sent(), btc_1.network]).sign(sighash),
                                                bitcoin.Transaction.SIGHASH_ALL])
                                        ]]);
                                    scriptWitness = Buffer.alloc(1);
                                    signetBlockSig = Buffer.concat([encodeVarUIntLE(scriptSig.length), scriptSig, scriptWitness]);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _b.label = 11;
                case 11:
                    if (!true) return [3 /*break*/, 13];
                    return [5 /*yield**/, _loop_1()];
                case 12:
                    state_1 = _b.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    return [3 /*break*/, 11];
                case 13: return [2 /*return*/];
            }
        });
    });
}
main();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var work, header, hash, block, p;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!true) return [3 /*break*/, 5];
                    return [4 /*yield*/, getWork()];
                case 1:
                    work = _a.sent();
                    return [4 /*yield*/, mine(work.block.slice(0, 76))];
                case 2:
                    header = _a.sent();
                    if (!header) return [3 /*break*/, 4];
                    header.copy(work.block);
                    hash = bitcoin.crypto.hash256(header).reverse().toString('hex');
                    console.log("Found block! ".concat(hash));
                    block = work.block.toString('hex');
                    (0, fs_1.writeFileSync)("/tmp/".concat(hash, "-").concat(new Date().getTime(), ".blk"), block);
                    process.stdout.write('submitblock...');
                    return [4 /*yield*/, (0, btc_1.btc)('submitblock', block)];
                case 3:
                    p = _a.sent();
                    if (p) {
                        console.log('\n' + p);
                        process.exit(1);
                    }
                    console.log(' ok');
                    if (templateFile) {
                        console.log("Falling back to bitcoind's blocktemplate");
                        templateFile = undefined;
                    }
                    work.mempool.forEach(function (m) {
                        (0, fs_1.copyFileSync)("mempool/".concat(m), "/tmp/".concat(m));
                        (0, fs_1.unlinkSync)("mempool/".concat(m));
                    });
                    blocks--;
                    if (blocks === 0) {
                        process.exit(0);
                    }
                    _a.label = 4;
                case 4: return [3 /*break*/, 0];
                case 5: return [2 /*return*/];
            }
        });
    });
}
var first = true;
function mine(header) {
    return new Promise(function (r, e) {
        var args = [header.toString('hex')];
        if (first) {
            first = false;
            args.push('info');
        }
        var p = (0, child_process_1.spawn)(minerd, args);
        var out = '';
        p.stdout.setEncoding('utf8');
        p.stdout.on('data', function (data) { return out += data.toString(); });
        p.stderr.setEncoding('utf8');
        p.stderr.pipe(process.stderr);
        p.on('close', function (code) {
            while (out.endsWith('\n')) {
                out = out.slice(0, -1);
            }
            if (code) {
                e(out);
            }
            else if (out) {
                r(Buffer.from(out, 'hex'));
            }
            else {
                r();
            }
        });
    });
}
function signetBlockSighash(header, challenge) {
    var toSpend = new bitcoin.Transaction();
    var toSign = new bitcoin.Transaction();
    toSpend.version = 0;
    toSpend.addInput(Buffer.alloc(32), 0xffffffff, 0);
    toSpend.setInputScript(0, bitcoin.script.compile([
        bitcoin.opcodes.OP_0,
        header
    ]));
    toSpend.addOutput(challenge, 0);
    toSign.version = 0;
    toSign.addInput(Buffer.from(toSpend.getId(), 'hex').reverse(), 0, 0);
    toSign.addOutput(bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN
    ]), 0);
    return {
        legacy: toSign.hashForSignature(0, challenge, bitcoin.Transaction.SIGHASH_ALL),
        witness_v0: toSign.hashForWitnessV0(0, challenge, 0, bitcoin.Transaction.SIGHASH_ALL),
        witness_v1: toSign.hashForWitnessV1(0, [challenge], [0], bitcoin.Transaction.SIGHASH_DEFAULT)
    };
}
