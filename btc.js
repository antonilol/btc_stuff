"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.consoleTrace = exports.OP_CHECKSIGADD = exports.chainEnvVarKey = exports.network = exports.networks = exports.Uint256 = exports.descsumCreate = void 0;
exports.setChain = setChain;
exports.btc = btc;
exports.newtx = newtx;
exports.signAndSend = signAndSend;
exports.fundTransaction = fundTransaction;
exports.send = send;
exports.listunspent = listunspent;
exports.listUnspent = listUnspent;
exports.getnewaddress = getnewaddress;
exports.getBlockTemplate = getBlockTemplate;
exports.decodeRawTransaction = decodeRawTransaction;
exports.getTXOut = getTXOut;
exports.getTransaction = getTransaction;
exports.testMempoolAccept = testMempoolAccept;
exports.getChainTips = getChainTips;
exports.getIndexInfo = getIndexInfo;
exports.getBlockChainInfo = getBlockChainInfo;
exports.fundOutputScript = fundOutputScript;
exports.fundAddress = fundAddress;
exports.validNetworks = validNetworks;
exports.negateIfOddPubkey = negateIfOddPubkey;
exports.ecPrivateMul = ecPrivateMul;
exports.ecPrivateInv = ecPrivateInv;
exports.ecPrivateDiv = ecPrivateDiv;
exports.tapLeaf = tapLeaf;
exports.tapBranch = tapBranch;
exports.tapTweak = tapTweak;
exports.bip86 = bip86;
exports.createTaprootOutput = createTaprootOutput;
exports.encodeVarUintLE = encodeVarUintLE;
exports.decodeVarUintLE = decodeVarUintLE;
exports.removeTransaction = removeTransaction;
exports.insertTransaction = insertTransaction;
exports.bech32toScriptPubKey = bech32toScriptPubKey;
exports.p2pkh = p2pkh;
exports.cloneBuf = cloneBuf;
exports.txidToString = txidToString;
exports.toSat = toSat;
exports.toBTC = toBTC;
exports.toSatvB = toSatvB;
exports.toBTCkvB = toBTCkvB;
exports.inputOnEOF = inputOnEOF;
exports.input = input;
exports.sleep = sleep;
const assert_1 = require("assert");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const child_process_1 = require("child_process");
const ecpair_1 = require("ecpair");
const readline_1 = require("readline");
const stream_1 = require("stream");
const curve = __importStar(require("tiny-secp256k1"));
var descriptors_1 = require("./descriptors");
Object.defineProperty(exports, "descsumCreate", { enumerable: true, get: function () { return descriptors_1.descsumCreate; } });
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
})(Uint256 || (exports.Uint256 = Uint256 = {}));
exports.networks = {
    main: bitcoin.networks.bitcoin,
    test: bitcoin.networks.testnet,
    testnet4: bitcoin.networks.testnet,
    regtest: bitcoin.networks.regtest,
    signet: bitcoin.networks.testnet,
};
let chain = 'testnet4';
exports.network = exports.networks[chain];
function setChain(c) {
    chain = c;
    exports.network = exports.networks[chain];
}
exports.chainEnvVarKey = 'BTC_STUFF_CHAIN';
const chainEnvVarValue = process.env[exports.chainEnvVarKey];
if (chainEnvVarValue) {
    if (exports.networks[chainEnvVarValue]) {
        setChain(chainEnvVarValue);
    }
    else {
        console.error(`Invalid chain "${chainEnvVarValue}", leaving it unchanged (currently set to ${chain})`);
    }
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
            else if (x instanceof bitcoin.Transaction) {
                arg = x.toHex();
            }
            else if (x instanceof bitcoin.Psbt) {
                arg = x.toBase64();
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
// sign, create and send new transaction
async function newtx(inputs, outputs, sat) {
    if (sat) {
        if (Array.isArray(outputs)) {
            for (const outs of outputs) {
                Object.keys(outs).forEach(k => {
                    if (k !== 'data') {
                        outs[k] = toBTC(outs[k]);
                    }
                });
            }
        }
        else {
            Object.keys(outputs).forEach(k => {
                if (k !== 'data') {
                    outputs[k] = toBTC(outputs[k]);
                }
            });
        }
    }
    const tx = await btc('createrawtransaction', inputs, outputs);
    return signAndSend(tx);
}
async function signAndSend(tx) {
    return send(JSON.parse(await btc('signrawtransactionwithwallet', tx)).hex);
}
async function fundTransaction(tx, convert = true) {
    const res = JSON.parse(await btc('fundrawtransaction', tx));
    if (convert) {
        res.tx = bitcoin.Transaction.fromHex(res.hex);
    }
    return res;
}
async function send(tx) {
    return btc('sendrawtransaction', tx);
}
/** @deprecated Use listUnspent instead */
async function listunspent(minamount, minconf, sat) {
    return JSON.parse(await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`)).map((u) => {
        if (sat) {
            u.amount = toSat(u.amount);
        }
        return u;
    });
}
/** Lists unspent transaction outputs (UTXOs) */
async function listUnspent(args = {}, sats = true) {
    const minconf = args.minconf === undefined ? 1 : args.minconf;
    const maxconf = args.maxconf === undefined ? 9999999 : args.maxconf;
    const addresses = args.addresses || [];
    const include_unsafe = args.include_unsafe === undefined ? true : args.include_unsafe;
    const query_options = {};
    for (const k in args) {
        if (['minimumAmount', 'maximumAmount', 'maximumCount', 'minimumSumAmount'].includes(k)) {
            query_options[k] = sats && k.endsWith('Amount') ? toBTC(args[k]) : args[k];
        }
    }
    const utxos = JSON.parse(await btc('listunspent', minconf, maxconf, addresses, include_unsafe, query_options));
    if (sats) {
        for (let i = 0; i < utxos.length; i++) {
            utxos[i].amount = toSat(utxos[i].amount);
        }
    }
    return utxos;
}
async function getnewaddress() {
    return btc('getnewaddress');
}
async function getBlockTemplate(template_request = { rules: ['segwit'] }) {
    const template = JSON.parse(await btc('getblocktemplate', template_request));
    updateTXDepends(template);
    return template;
}
async function decodeRawTransaction(tx) {
    return JSON.parse(await btc('decoderawtransaction', tx));
}
async function getTXOut(txid, vout, include_mempool = true) {
    const txout = await btc('gettxout', txidToString(txid), vout, include_mempool);
    if (txout) {
        return JSON.parse(txout);
    }
}
async function getTransaction(txid, includeWatchonly = true, verbose = false) {
    return JSON.parse(await btc('gettransaction', txidToString(txid), includeWatchonly, verbose));
}
async function testMempoolAccept(txs, maxfeerate) {
    const arr = Array.isArray(txs);
    const res = JSON.parse(await (maxfeerate === undefined
        ? btc('testmempoolaccept', arr ? txs : [txs])
        : btc('testmempoolaccept', arr ? txs : [txs], toBTCkvB(maxfeerate))));
    return arr ? res : res[0];
}
async function getChainTips() {
    return JSON.parse(await btc('getchaintips'));
}
async function getIndexInfo(index) {
    return JSON.parse(await btc('getindexinfo', index || ''));
}
async function getBlockChainInfo() {
    return JSON.parse(await btc('getblockchaininfo'));
}
async function fundOutputScript(scriptPubKey, amount, locktime = 0, version = 2) {
    const tx = new bitcoin.Transaction();
    tx.version = version;
    tx.addOutput(scriptPubKey, amount);
    tx.locktime = locktime;
    const funded = await fundTransaction(tx, true);
    const vout = funded.tx.outs.findIndex(output => output.value === amount && output.script.equals(scriptPubKey));
    (0, assert_1.strict)(vout != -1);
    await signAndSend(funded.hex);
    return {
        txid: funded.tx.getId(),
        txidBytes: Buffer.from(funded.tx.getId(), 'hex').reverse(),
        vout,
        hex: funded.hex,
    };
}
/** @deprecated Use `fundOutputScript(bitcoin.address.toOutputScript(address, network), amount)` instead */
async function fundAddress(address, amount) {
    const txid = await btc('sendtoaddress', address, toBTC(amount));
    const vout = (await getTransaction(txid)).details.find(x => x.address == address).vout;
    return { txid, vout };
}
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
exports.OP_CHECKSIGADD = 0xba; // this is not merged yet: https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742
const ONE = Uint256.toBuffer(1n);
const N_LESS_1 = Buffer.from(curve.privateSub(ONE, Uint256.toBuffer(2n)));
function negateIfOddPubkey(d) {
    const pub = curve.pointFromScalar(d, true);
    if (!pub) {
        return;
    }
    if (pub[0] == 3) {
        const d1 = curve.privateSub(N_LESS_1, d);
        if (!d1) {
            return;
        }
        const d2 = curve.privateAdd(d1, ONE);
        if (!d2) {
            return;
        }
        return Buffer.from(d2);
    }
    return Buffer.from(d);
}
// const EC_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn // not used yet
const EC_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
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
function ecPrivateInv(a) {
    let an = Uint256.toBigint(a);
    if (an <= 0n || an >= EC_N) {
        throw new Error('a out of range');
    }
    let m = EC_N;
    let y1 = 1n;
    let y2 = 0n;
    while (an > 1) {
        [y1, y2] = [y2 - (m / an) * y1, y1];
        [an, m] = [m % an, an];
    }
    return Uint256.toBuffer(((y1 % EC_N) + EC_N) % EC_N);
}
function ecPrivateDiv(a, b) {
    return ecPrivateMul(a, ecPrivateInv(b));
}
function tapLeaf(script) {
    return bitcoin.crypto.taggedHash('TapLeaf', Buffer.concat([Buffer.from([0xc0]), encodeVarUintLE(script.length), script]));
}
function tapBranch(branch1, branch2) {
    return bitcoin.crypto.taggedHash('TapBranch', Buffer.concat(branch1 < branch2 ? [branch1, branch2] : [branch2, branch1]));
}
function tapTweak(pubkey, root) {
    return bitcoin.crypto.taggedHash('TapTweak', root ? Buffer.concat([pubkey.subarray(-32), root]) : pubkey.subarray(-32));
}
function bip86(ecpair) {
    const tweak = tapTweak(ecpair.publicKey);
    const opts = {
        compressed: ecpair.compressed,
        network: ecpair.network,
    };
    if (ecpair.privateKey) {
        const priv = curve.privateAdd(ecpair.privateKey, tweak);
        if (!priv) {
            return;
        }
        return ECPair.fromPrivateKey(Buffer.from(priv), opts);
    }
    const pub = curve.pointAddScalar(ecpair.publicKey, tweak);
    if (!pub) {
        return;
    }
    return ECPair.fromPublicKey(Buffer.from(pub), opts);
}
function createTaprootOutput(pubkey, root) {
    const tweaked = curve.pointAddScalar(pubkey, tapTweak(pubkey, root));
    if (!tweaked) {
        return;
    }
    const key = Buffer.from(tweaked).subarray(-32);
    return {
        key,
        parity: (tweaked[0] & 1),
        scriptPubKey: bitcoin.script.compile([bitcoin.opcodes.OP_1, key]),
        address: bitcoin.address.toBech32(key, 1, exports.network.bech32),
    };
}
// Utils
function encodeVarUintLE(n) {
    if (typeof n === 'number') {
        (0, assert_1.strict)(n >= 0 && n <= Number.MAX_SAFE_INTEGER && n % 1 === 0);
        n = BigInt(n);
    }
    else {
        (0, assert_1.strict)(n >= 0n && n <= 0xffffffffffffffffn);
    }
    if (n > 0xffffffffn) {
        const buf = Buffer.allocUnsafe(9);
        buf.writeUint8(0xff);
        buf.writeBigUint64LE(n, 1);
        return buf;
    }
    else if (n > 0xffffn) {
        const buf = Buffer.allocUnsafe(5);
        buf.writeUint8(0xfe);
        buf.writeUint32LE(Number(n), 1);
        return buf;
    }
    else if (n > 0xfcn) {
        const buf = Buffer.allocUnsafe(3);
        buf.writeUint8(0xfd);
        buf.writeUint16LE(Number(n), 1);
        return buf;
    }
    else {
        const buf = Buffer.allocUnsafe(1);
        buf.writeUint8(Number(n));
        return buf;
    }
}
function decodeVarUintLE(buf, bigint) {
    let n;
    if (buf[0] === 0xff && buf.length >= 9) {
        const n = buf.readBigUint64LE(1);
        if (bigint) {
            return n;
        }
        else {
            (0, assert_1.strict)(n <= Number.MAX_SAFE_INTEGER);
            return Number(n);
        }
    }
    else if (buf[0] === 0xfe && buf.length >= 5) {
        n = buf.readUint32LE(1);
    }
    else if (buf[0] === 0xfd && buf.length >= 3) {
        n = buf.readUint16LE(1);
    }
    else {
        n = buf.readUint8();
    }
    return bigint ? BigInt(n) : n;
}
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
    template.coinbasevalue -= removed.reduce((v, x) => v + (x.fee || 0), 0);
    updateNumberDepends(template);
    return removed;
}
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
        weight: rawtx.weight,
    };
    template.transactions.push(tx);
    updateNumberDepends(template);
    return true;
}
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
function p2pkh(pub) {
    return bitcoin.script.compile([
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,
        bitcoin.crypto.hash160(pub),
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_CHECKSIG,
    ]);
}
/** @deprecated Use `Buffer.from` instead */
function cloneBuf(buf) {
    return Buffer.from(buf);
}
function txidToString(txid) {
    if (typeof txid === 'string') {
        return txid;
    }
    return Buffer.from(txid).reverse().toString('hex');
}
function toSat(btcAmount) {
    // prevent floating point quirks: 4.24524546 * 1e8 = 424524545.99999994
    return Math.round(btcAmount * 1e8);
}
function toBTC(satAmount) {
    // prevent floating point quirks: 424524546 * 1e-8 = 4.2452454600000005
    return parseFloat((satAmount * 1e-8).toFixed(8));
}
/** Converts a fee rate in BTC/kvB to sat/vB */
function toSatvB(btckvB) {
    return toSat(btckvB) / 1000;
}
/** Converts a fee rate in sat/vB to BTC/kvB */
function toBTCkvB(satvB) {
    return toBTC(Math.round(satvB * 1000));
}
const eofCallbacks = [];
function inputOnEOF(cb) {
    eofCallbacks.push(cb);
}
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
            },
        }),
        terminal: true,
    });
    return new Promise(r => {
        let resolved = false;
        rl.question(q, a => {
            r(a);
            resolved = true;
            rl.close();
        });
        rl.on('close', () => {
            if (!resolved) {
                console.log();
                eofCallbacks.forEach(cb => cb());
            }
        });
        active = true;
    });
}
async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
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
                if (e instanceof Error && e.stack) {
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
        },
    ];
}));
