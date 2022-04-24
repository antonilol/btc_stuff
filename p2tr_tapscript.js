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
var curve = require("tiny-secp256k1");
var bitcoin = require("bitcoinjs-lib");
var btc_1 = require("./btc");
var ecpair_1 = require("ecpair");
var ECPair = (0, ecpair_1.ECPairFactory)(curve);
var network = bitcoin.networks.testnet;
var hashtype = bitcoin.Transaction.SIGHASH_DEFAULT;
var internalKey = (0, btc_1.randomInternalKey)({ network: network });
var ecpair2 = ECPair.makeRandom({ network: network });
// build taptree
var leaf1script = bitcoin.script.compile([
    ecpair2.publicKey.slice(1, 33),
    bitcoin.opcodes.OP_CHECKSIG,
    ecpair2.publicKey.slice(1, 33),
    btc_1.OP_CHECKSIGADD,
    bitcoin.opcodes.OP_2,
    bitcoin.opcodes.OP_EQUAL
]);
var leaf1 = (0, btc_1.tapLeaf)(leaf1script);
var leaf2 = Buffer.alloc(32); // all zeros
var branch = (0, btc_1.tapBranch)(leaf1, leaf2);
var tweak = (0, btc_1.tapTweak)(internalKey.publicKey, branch);
var tr = (0, btc_1.createTaprootOutput)(internalKey.publicKey, tweak);
var fee_sat = 150;
var input_sat = 1000;
var address = bitcoin.address.toBech32(tr.key, 1, network.bech32);
console.log(address);
(0, btc_1.fundAddress)(address, input_sat).then(function (outpoint) { return __awaiter(void 0, void 0, void 0, function () {
    var tx, _a, _b, _c, sighash, signature, pub, ctrl, decoded;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                tx = new bitcoin.Transaction();
                tx.version = 2;
                tx.addInput(Buffer.from(outpoint.txid, 'hex').reverse(), outpoint.vout);
                _b = (_a = tx).addOutput;
                _c = btc_1.bech32toScriptPubKey;
                return [4 /*yield*/, (0, btc_1.getnewaddress)()];
            case 1:
                _b.apply(_a, [_c.apply(void 0, [_d.sent()]), input_sat - fee_sat]);
                sighash = tx.hashForWitnessV1(0, // which input
                [
                    bitcoin.script.compile([
                        bitcoin.opcodes.OP_1,
                        tr.key
                    ])
                ], // All previous outputs of all inputs
                [input_sat], // All previous values of all inputs
                hashtype, // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
                leaf1);
                signature = Buffer.from(curve.signSchnorr(sighash, ecpair2.privateKey));
                pub = internalKey.publicKey;
                pub.writeUint8(0xc0 | tr.parity);
                ctrl = Buffer.concat([pub, leaf2]);
                tx.setWitness(0, [
                    signature,
                    signature,
                    leaf1script,
                    ctrl
                ]);
                return [4 /*yield*/, (0, btc_1.decodeRawTransaction)(tx.toHex())];
            case 2:
                decoded = _d.sent();
                console.log(JSON.stringify(decoded, null, 2));
                console.log(tx.toHex());
                return [4 /*yield*/, (0, btc_1.send)(tx.toHex())];
            case 3:
                _d.sent();
                console.log('sendrawtransaction successful');
                return [2 /*return*/];
        }
    });
}); });
