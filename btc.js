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
exports.consoleTrace = exports.sleep = exports.input = exports.toBTC = exports.toSat = exports.txidToString = exports.cloneBuf = exports.bech32toScriptPubKey = exports.insertTransaction = exports.removeTransaction = exports.setChain = exports.createTaprootOutput = exports.bip86 = exports.tapTweak = exports.tapBranch = exports.tapLeaf = exports.ecPrivateMul = exports.negateIfOddPubkey = exports.OP_CHECKSIGADD = exports.validNetworks = exports.fundAddress = exports.getTXOut = exports.decodeRawTransaction = exports.getBlockTemplate = exports.getnewaddress = exports.listUnspent = exports.listunspent = exports.send = exports.fundTransaction = exports.signAndSend = exports.newtx = exports.btc = exports.network = exports.networks = exports.Uint256 = void 0;
const child_process_1 = require("child_process");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const curve = __importStar(require("tiny-secp256k1"));
const readline_1 = require("readline");
const stream_1 = require("stream");
const ecpair_1 = require("ecpair");
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
var Uint256;
(function (Uint256) {
    function toBigint(b) {
        return BigInt('0x' + Buffer.from(b).toString('hex'));
    }
    Uint256.toBigint = toBigint;
    function toBuffer(n) {
        return Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
    }
    Uint256.toBuffer = toBuffer;
})(Uint256 = exports.Uint256 || (exports.Uint256 = {}));
exports.networks = {
    main: bitcoin.networks.bitcoin,
    test: bitcoin.networks.testnet,
    regtest: bitcoin.networks.regtest,
    signet: bitcoin.networks.testnet
};
let chain = 'test';
exports.network = exports.networks[chain];
async function btc(...args) {
    return new Promise((r, e) => {
        const cmdargs = [`-chain=${chain}`, '-stdin'];
        while (args.length && typeof args[0] === 'string' && args[0].startsWith('-')) {
            cmdargs.push(args.shift());
        }
        const p = (0, child_process_1.spawn)('bitcoin-cli', cmdargs);
        let out = '';
        p.stdout.setEncoding('utf8');
        p.stdout.on('data', data => {
            out += data.toString();
        });
        p.stderr.setEncoding('utf8');
        p.stderr.on('data', data => {
            out += data.toString();
        });
        p.on('close', code => {
            while (out.endsWith('\n')) {
                out = out.slice(0, -1);
            }
            (code ? e : r)(out);
        });
        p.stdin.write(args
            .map(x => {
            let arg;
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
        })
            .join('\n'));
        p.stdin.end();
    });
}
exports.btc = btc;
// sign, create and send new transaction
async function newtx(inputs, outputs, sat) {
    if (sat) {
        Object.keys(outputs).forEach(k => {
            if (k !== 'data') {
                outputs[k] = parseFloat((outputs[k] * 1e-8).toFixed(8));
            }
        });
    }
    const tx = await btc('createrawtransaction', inputs, outputs);
    return signAndSend(tx);
}
exports.newtx = newtx;
async function signAndSend(hex) {
    return send(JSON.parse(await btc('signrawtransactionwithwallet', hex)).hex);
}
exports.signAndSend = signAndSend;
async function fundTransaction(tx) {
    const res = JSON.parse(await btc('fundrawtransaction', tx.toHex()));
    res.tx = bitcoin.Transaction.fromHex(res.hex);
    delete res.hex;
    return res;
}
exports.fundTransaction = fundTransaction;
async function send(hex) {
    return btc('sendrawtransaction', hex);
}
exports.send = send;
/** @deprecated Use listUnspent instead */
async function listunspent(minamount, minconf, sat) {
    return JSON.parse(await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`)).map((u) => {
        if (sat) {
            u.amount = toSat(u.amount);
        }
        return u;
    });
}
exports.listunspent = listunspent;
/** Lists unspent transaction outputs (UTXOs) */
async function listUnspent(args = {}, sats = true) {
    const minconf = args.minconf === undefined ? 1 : args.minconf;
    const maxconf = args.maxconf === undefined ? 9999999 : args.maxconf;
    const addresses = args.addresses || [];
    const include_unsafe = args.include_unsafe === undefined ? true : args.include_unsafe;
    const query_options = {};
    for (const k in args) {
        if (['minimumAmount', 'maximumAmount', 'maximumCount', 'minimumSumAmount'].includes(k)) {
            query_options[k] = sats && k.endsWith('Amount') ? toSat(args[k]) : args[k];
        }
    }
    return JSON.parse(await btc('listunspent', minconf, maxconf, addresses, include_unsafe, query_options));
}
exports.listUnspent = listUnspent;
async function getnewaddress() {
    return btc('getnewaddress');
}
exports.getnewaddress = getnewaddress;
async function getBlockTemplate(template_request = { rules: ['segwit'] }) {
    const template = JSON.parse(await btc('getblocktemplate', template_request));
    updateTXDepends(template);
    return template;
}
exports.getBlockTemplate = getBlockTemplate;
async function decodeRawTransaction(txHex) {
    return JSON.parse(await btc('decoderawtransaction', txHex));
}
exports.decodeRawTransaction = decodeRawTransaction;
async function getTXOut(txid, vout, include_mempool = true) {
    const txout = await btc('gettxout', txidToString(txid), vout, include_mempool);
    if (txout) {
        return JSON.parse(txout);
    }
}
exports.getTXOut = getTXOut;
// export function fundScript(scriptPubKey: Buffer, amount: number): Promise<UTXO | void> { /* TODO */ }
async function fundAddress(address, amount) {
    // return fundScript(bitcoin.address.toOutputScript(address, network), amount);
    const txid = await btc('sendtoaddress', address, toBTC(amount));
    const vout = JSON.parse(await btc('gettransaction', txid)).details.find(x => x.address == address).vout;
    return { txid, vout };
}
exports.fundAddress = fundAddress;
function validNetworks(address) {
    const output = {};
    for (const net of Object.entries(bitcoin.networks)) {
        try {
            bitcoin.address.toOutputScript(address, net[1]);
            output[net[0]] = net[1];
        }
        catch (e) { }
    }
    return output;
}
exports.validNetworks = validNetworks;
exports.OP_CHECKSIGADD = 0xba; // this is not merged yet: https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742
const ONE = Uint256.toBuffer(1n);
const N_LESS_1 = Buffer.from(curve.privateSub(ONE, Uint256.toBuffer(2n)));
function negateIfOddPubkey(d) {
    if (curve.pointFromScalar(d, true)[0] == 3) {
        return Buffer.from(curve.privateAdd(curve.privateSub(N_LESS_1, d), ONE));
    }
    return Buffer.from(d);
}
exports.negateIfOddPubkey = negateIfOddPubkey;
const EC_N = Uint256.toBigint(N_LESS_1) + 1n;
function ecPrivateMul(a, b) {
    const an = Uint256.toBigint(a);
    const bn = Uint256.toBigint(b);
    if (an <= 0n || an >= EC_N) {
        throw new Error('a out of range');
    }
    if (bn <= 0n || bn >= EC_N) {
        throw new Error('b out of range');
    }
    return Uint256.toBuffer((an * bn) % EC_N);
}
exports.ecPrivateMul = ecPrivateMul;
function tapLeaf(script) {
    return bitcoin.crypto.taggedHash('TapLeaf', Buffer.concat([Buffer.from([0xc0, script.length]), script]));
}
exports.tapLeaf = tapLeaf;
function tapBranch(branch1, branch2) {
    return bitcoin.crypto.taggedHash('TapBranch', Buffer.concat(branch1 < branch2 ? [branch1, branch2] : [branch2, branch1]));
}
exports.tapBranch = tapBranch;
function tapTweak(pubkey, root) {
    return bitcoin.crypto.taggedHash('TapTweak', root ? Buffer.concat([pubkey.slice(-32), root]) : pubkey.slice(-32));
}
exports.tapTweak = tapTweak;
function bip86(ecpair) {
    const tweak = tapTweak(ecpair.publicKey);
    const opts = {
        compressed: ecpair.compressed,
        network: ecpair.network
    };
    if (ecpair.privateKey) {
        return ECPair.fromPrivateKey(Buffer.from(curve.privateAdd(ecpair.privateKey, tweak)), opts);
    }
    return ECPair.fromPublicKey(Buffer.from(curve.pointAddScalar(ecpair.publicKey, tweak)), opts);
}
exports.bip86 = bip86;
function createTaprootOutput(pubkey, root) {
    const tweaked = curve.pointAddScalar(pubkey, tapTweak(pubkey, root));
    const key = Buffer.from(tweaked).slice(-32);
    return {
        key,
        parity: (tweaked[0] & 1),
        scriptPubKey: bitcoin.script.compile([bitcoin.opcodes.OP_1, key]),
        address: bitcoin.address.toBech32(key, 1, exports.network.bech32)
    };
}
exports.createTaprootOutput = createTaprootOutput;
function setChain(c) {
    chain = c;
    exports.network = exports.networks[chain];
}
exports.setChain = setChain;
// Utils
// remove a transaction from a templateFile
// removes all dependendencies
// subtracts fee of removed transactions from coinbasevalue
// returns all removed transactions
function removeTransaction(template, txid) {
    const txs = template.transactions;
    const tx = txs.find(x => x.txid == txid);
    if (!tx) {
        return [];
    }
    const toRemove = [tx];
    const removed = [];
    while (toRemove.length) {
        const tx = toRemove.shift();
        toRemove.push(...tx.TXdepends);
        removed.push(...txs.splice(txs.indexOf(tx), 1));
    }
    template.coinbasevalue -= removed.reduce((v, x) => v + x.fee, 0);
    updateNumberDepends(template);
    return removed;
}
exports.removeTransaction = removeTransaction;
async function insertTransaction(template, data) {
    const rawtx = await decodeRawTransaction(data);
    if (template.transactions.find(x => x.txid == rawtx.txid)) {
        return false;
    }
    const tx = {
        data: Buffer.isBuffer(data) ? data.toString('hex') : data,
        txid: rawtx.txid,
        hash: rawtx.hash,
        depends: [],
        TXdepends: template.transactions.filter(x => rawtx.vin.map(y => y.txid).includes(x.txid)),
        weight: rawtx.weight
    };
    template.transactions.push(tx);
    updateNumberDepends(template);
    return true;
}
exports.insertTransaction = insertTransaction;
function updateTXDepends(template) {
    for (const tx of template.transactions) {
        tx.TXdepends = tx.depends.map(i => template.transactions[i - 1]);
    }
}
function updateNumberDepends(template) {
    for (const tx of template.transactions) {
        tx.depends = tx.TXdepends.map(tx => template.transactions.indexOf(tx) + 1);
    }
}
function bech32toScriptPubKey(a) {
    const z = bitcoin.address.fromBech32(a);
    return bitcoin.script.compile([bitcoin.script.number.encode(z.version), bitcoin.address.fromBech32(a).data]);
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
function toSat(btcAmount) {
    // prevent floating point quirks: 4.24524546 * 1e8 = 424524545.99999994
    return Math.round(btcAmount * 1e8);
}
exports.toSat = toSat;
function toBTC(satAmount) {
    // prevent floating point quirks: 424524546 * 1e-8 = 4.2452454600000005
    return parseFloat((satAmount * 1e-8).toFixed(8));
}
exports.toBTC = toBTC;
async function input(q, hide = false) {
    let active = false;
    const rl = (0, readline_1.createInterface)({
        input: process.stdin,
        output: new stream_1.Writable({
            write: (chunk, encoding, cb) => {
                const c = Buffer.from(chunk, encoding);
                if (active && hide) {
                    if (c.toString() == '\r\n' || c.toString() == '\n') {
                        console.log();
                        return cb();
                    }
                }
                else {
                    process.stdout.write(c);
                }
                cb();
            }
        }),
        terminal: true
    });
    const ret = new Promise(r => rl.question(q, a => {
        r(a);
        rl.close();
    }));
    active = true;
    return ret;
}
exports.input = input;
async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
exports.sleep = sleep;
// from https://stackoverflow.com/a/47296370/13800918, edited
exports.consoleTrace = Object.fromEntries(['log', 'warn', 'error'].map(methodName => {
    return [
        methodName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (...args) => {
            let initiator = 'unknown place';
            try {
                throw new Error();
            }
            catch (e) {
                if (typeof e.stack === 'string') {
                    let isFirst = true;
                    for (const line of e.stack.split('\n')) {
                        const matches = line.match(/^\s+at\s+(.*)/);
                        if (matches) {
                            if (!isFirst) {
                                initiator = matches[1];
                                break;
                            }
                            isFirst = false;
                        }
                    }
                }
            }
            console[methodName](...args, '\n', `	at ${initiator}`);
        }
    ];
}));
