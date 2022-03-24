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
var child_process_1 = require("child_process");
var bitcoin = require("bitcoinjs-lib");
var btc_1 = require("./btc");
var merkle_tree_1 = require("./merkle_tree");
var assert_1 = require("assert");
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var path_1 = require("path");
// i say DONT CHEAT it is only here for me :)
var cheat = false;
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
function createCoinbase(address, value, height, txs, message) {
    var tx = new bitcoin.Transaction();
    // in
    tx.addInput(Buffer.alloc(32), 0xffffffff);
    tx.setInputScript(0, bitcoin.script.compile([
        bitcoin.script.number.encode(height),
        Buffer.concat([
            Buffer.from(message),
            Buffer.from('f09f87acf09f87a7f09fa4a2f09fa4ae', 'hex') // <-- BIP69420
        ])
    ]));
    tx.setWitness(0, [Buffer.alloc(32)]);
    // block reward + fees
    tx.addOutput((0, btc_1.bech32toScriptPubKey)(address), value);
    // OP_RETURN with witness commitment
    var wtxids = txs.map(function (x) { return x.hash; });
    wtxids.splice(0, 0, Buffer.alloc(32));
    tx.addOutput(bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN,
        Buffer.concat([
            wCommitHeader,
            bitcoin.crypto.hash256(Buffer.concat([
                (0, merkle_tree_1.merkleRoot)(wtxids),
                Buffer.alloc(32)
            ]))
        ]),
        (0, crypto_1.randomBytes)(4)
    ]), 0);
    // serialize
    var coinbase = tx.toBuffer();
    var txid = tx.getId();
    return { tx: coinbase, txid: txid };
}
function getWork() {
    return __awaiter(this, void 0, void 0, function () {
        var t, time, prev, txs, txids, mempool, txcount, message, address, coinbase, txlen, txoffset, block, o, mRoot;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!templateFile) return [3 /*break*/, 1];
                    t = JSON.parse((0, fs_1.readFileSync)(templateFile).toString());
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, (0, btc_1.getBlockTemplate)()];
                case 2:
                    t = _a.sent();
                    _a.label = 3;
                case 3:
                    if (!cheat) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, btc_1.btc)('getblockheader', t.previousblockhash)];
                case 4:
                    prev = _a.sent();
                    time = JSON.parse(prev).time + 20 * 60 + 1;
                    return [3 /*break*/, 6];
                case 5:
                    time = Math.floor(new Date().getTime() / 1000);
                    _a.label = 6;
                case 6:
                    txs = t.transactions;
                    txids = txs.map(function (x) { return x.txid; });
                    mempool = (0, fs_1.readdirSync)('mempool');
                    return [4 /*yield*/, Promise.all(mempool.map(function (f) { return __awaiter(_this, void 0, void 0, function () {
                            var hex, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        hex = (0, fs_1.readFileSync)("mempool/".concat(f)).toString().split('\n').find(function (x) { return x; });
                                        _a = [hex];
                                        return [4 /*yield*/, (0, btc_1.decodeRawTransaction)(hex)];
                                    case 1: return [2 /*return*/, _a.concat([
                                            _b.sent()
                                        ])];
                                }
                            });
                        }); }))];
                case 7:
                    (_a.sent()).forEach(function (tx) {
                        if (txids.includes(tx[1].txid)) {
                            return;
                        }
                        txs.splice(0, 0, {
                            data: tx[0],
                            txid: tx[1].txid,
                            hash: tx[1].hash,
                            depends: [],
                            weight: 0
                        });
                        txids.splice(0, 0, tx[1].txid);
                    });
                    txcount = encodeVarUIntLE(txs.length + 1);
                    message = "Hello from block ".concat(t.height, "!");
                    address = '';
                    if (!address) {
                        btc_1.consoleTrace.error('No payout address specified!');
                        process.exit(1);
                    }
                    coinbase = createCoinbase(address, t.coinbasevalue, t.height, txs, message);
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
                    txids.splice(0, 0, coinbase.txid);
                    mRoot = (0, merkle_tree_1.merkleRoot)(txids);
                    block.writeUInt32LE(t.version);
                    Buffer.from(t.previousblockhash, 'hex').reverse().copy(block, 4);
                    mRoot.copy(block, 36);
                    block.writeUInt32LE(time, 68);
                    Buffer.from(cheat ? '1d00ffff' : t.bits, 'hex').reverse().copy(block, 72);
                    return [2 /*return*/, { block: block, mempool: mempool }];
            }
        });
    });
}
var minerd = "".concat((0, path_1.dirname)(process.argv[1]), "/cpuminer/minerd");
templateFile = process.argv[2];
if (templateFile) {
    console.log("Using block template from ".concat(templateFile));
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
                        return [2 /*return*/];
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
                    _a.label = 4;
                case 4: return [3 /*break*/, 0];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function mine(header) {
    return new Promise(function (r, e) {
        var p = (0, child_process_1.spawn)(minerd, [header.toString('hex')]);
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
