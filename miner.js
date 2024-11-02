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
const child_process_1 = require("child_process");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const btc_1 = require("./btc");
const merkle_tree_1 = require("./merkle_tree");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const curve = __importStar(require("tiny-secp256k1"));
const ecpair_1 = require("ecpair");
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
function readConfig() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function jsonType(value) {
        if (Array.isArray(value)) {
            return 'array';
        }
        else {
            return typeof value;
        }
    }
    const config = {
        difficulty1: false,
        minerd_binary: `${(0, path_1.dirname)(process.argv[1])}/cpuminer/minerd`,
        segwit: true,
        signet: false,
        coinbase_address: 'tb1qllllllxl536racn7h9pew8gae7tyu7d58tgkr3',
        coinbase_message: ' github.com/antonilol/btc_stuff ',
    };
    const configFilePath = 'miner.json';
    if ((0, fs_1.existsSync)(configFilePath)) {
        const configFile = JSON.parse((0, fs_1.readFileSync)(configFilePath).toString());
        const errors = [];
        Object.keys(config).forEach(key => {
            const configFileValue = configFile[key];
            if (configFileValue === undefined) {
                return;
            }
            const expectedType = jsonType(config[key]);
            const actualType = jsonType(configFileValue);
            if (expectedType !== actualType) {
                errors.push(`expected value of key "${key}" to have type ${expectedType} but found ${actualType}`);
                return;
            }
            config[key] = configFileValue;
        });
        if (errors.length !== 0) {
            throw new Error(`Invalid type${errors.length === 1 ? '' : 's'} in config file: ${errors.join(', ')}`);
        }
    }
    return config;
}
const config = readConfig();
if (config.signet) {
    (0, btc_1.setChain)('signet');
}
const args = process.argv.slice(2);
let blocks = -1;
if (args.length > 0) {
    blocks = parseInt(args[0]);
    if (blocks === 0) {
        process.exit(0);
    }
    if (!blocks || blocks < -1) {
        console.log('Provide a positive integer or -1 for no block limit');
        process.exit(1);
    }
}
let templateFile;
if (args.length > 1) {
    templateFile = args[1];
    if (templateFile) {
        console.log(`Using block template from ${templateFile}`);
    }
}
// see BIP141
const wCommitHeader = Buffer.from('aa21a9ed', 'hex');
// see BIP325
const signetHeader = Buffer.from('ecc7daa2', 'hex');
function createCoinbase(address, value, height, txs, message, extraNonce, signetBlockSig) {
    const tx = new bitcoin.Transaction();
    // in
    tx.addInput(Buffer.alloc(32), 0xffffffff);
    tx.setInputScript(0, Buffer.concat([
        bitcoin.script.compile([bitcoin.script.number.encode(height)]),
        extraNonce,
        Buffer.from(message),
    ]));
    // block reward + fees
    tx.addOutput((0, btc_1.bech32toScriptPubKey)(address), value);
    const commits = [];
    if (config.segwit) {
        // witness commitment
        const wtxids = txs.map(x => x.hash);
        wtxids.splice(0, 0, Buffer.alloc(32));
        commits.push(Buffer.concat([
            wCommitHeader,
            bitcoin.crypto.hash256(Buffer.concat([(0, merkle_tree_1.merkleRoot)(wtxids), Buffer.alloc(32)])),
        ]));
        tx.setWitness(0, [Buffer.alloc(32)]);
    }
    if (config.signet) {
        // signet block signature
        commits.push(Buffer.concat([signetHeader, signetBlockSig ? signetBlockSig : Buffer.alloc(0)]));
    }
    if (commits.length) {
        tx.addOutput(bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, ...commits]), 0);
    }
    // serialize
    const coinbase = tx.toBuffer();
    const txid = tx.getId();
    return { tx: coinbase, txid };
}
async function getWork() {
    let t;
    if (templateFile) {
        t = JSON.parse((0, fs_1.readFileSync)(templateFile).toString());
    }
    else {
        const req = { rules: ['segwit'] };
        if (config.signet) {
            req.rules.push('signet');
        }
        t = await (0, btc_1.getBlockTemplate)(req);
    }
    let time;
    if (config.difficulty1) {
        const prev = await (0, btc_1.btc)('getblockheader', t.previousblockhash);
        time = JSON.parse(prev).time + 20 * 60 + 1;
    }
    else {
        time = Math.floor(new Date().getTime() / 1000);
    }
    const txs = t.transactions;
    const mempool = (0, fs_1.readdirSync)('mempool');
    for (const tx of mempool.map(f => (0, fs_1.readFileSync)(`mempool/${f}`).toString().trim())) {
        await (0, btc_1.insertTransaction)(t, tx);
    }
    if (!config.segwit) {
        let toRemove;
        let removed = 0;
        while ((toRemove = t.transactions.find(x => x.hash != x.txid))) {
            removed += (0, btc_1.removeTransaction)(t, toRemove.txid).length;
        }
        console.log(`SegWit is disabled`);
        console.log(`Excluded ${removed} SegWit transactions from the block`);
    }
    const txcount = (0, btc_1.encodeVarUintLE)(txs.length + 1);
    const extraNonce = (0, crypto_1.randomBytes)(4);
    let signetBlockSig;
    while (true) {
        const coinbase = createCoinbase(config.coinbase_address, t.coinbasevalue, t.height, txs, config.coinbase_message, extraNonce, signetBlockSig);
        let txlen = coinbase.tx.length;
        txs.forEach(tx => {
            txlen += tx.data.length / 2;
        });
        const txoffset = 80 + txcount.length;
        const block = Buffer.allocUnsafe(txoffset + txlen);
        txcount.copy(block, 80);
        coinbase.tx.copy(block, txoffset);
        let o = txoffset + coinbase.tx.length;
        txs.forEach(tx => {
            const data = Buffer.from(tx.data, 'hex');
            data.copy(block, o);
            o += data.length;
        });
        const mRoot = (0, merkle_tree_1.merkleRoot)([coinbase.txid, ...txs.map(x => x.txid)]);
        block.writeUint32LE(t.version);
        Buffer.from(t.previousblockhash, 'hex').reverse().copy(block, 4);
        mRoot.copy(block, 36);
        block.writeUint32LE(time, 68);
        Buffer.from(config.difficulty1 ? '1d00ffff' : t.bits, 'hex')
            .reverse()
            .copy(block, 72);
        if (!config.signet || signetBlockSig) {
            return { block, mempool };
        }
        // signing code, change to your own needs
        const sighash = signetBlockSighash(block.subarray(0, 72), Buffer.from(t.signet_challenge, 'hex')).legacy;
        const scriptSig = bitcoin.script.compile([
            bitcoin.script.signature.encode(ECPair.fromWIF(await (0, btc_1.btc)('dumpprivkey', 'tb1qllllllxl536racn7h9pew8gae7tyu7d58tgkr3'), btc_1.network).sign(sighash), bitcoin.Transaction.SIGHASH_ALL),
        ]);
        const scriptWitness = Buffer.alloc(1);
        signetBlockSig = Buffer.concat([(0, btc_1.encodeVarUintLE)(scriptSig.length), scriptSig, scriptWitness]);
    }
}
main();
async function main() {
    while (true) {
        const work = await getWork();
        const { result, terminate } = mine(work.block.subarray(0, 76));
        // hacky way to check which of the two resolved first
        if (typeof (await Promise.any([result, (0, btc_1.btc)('waitfornewblock')])) === 'string') {
            terminate();
            console.log('Received block, restarting');
            continue;
        }
        const header = await result;
        if (header) {
            header.copy(work.block);
            const hash = bitcoin.crypto.hash256(header).reverse().toString('hex');
            console.log(`Found block! ${hash}`);
            const block = work.block.toString('hex');
            (0, fs_1.writeFileSync)(`/tmp/${hash}-${new Date().getTime()}.blk`, block);
            process.stdout.write('submitblock...');
            const p = await (0, btc_1.btc)('submitblock', block);
            if (p) {
                console.log('\n' + p);
                process.exit(1);
            }
            console.log(' ok');
            if (templateFile) {
                console.log(`Falling back to bitcoind's blocktemplate`);
                templateFile = undefined;
            }
            work.mempool.forEach(m => {
                (0, fs_1.copyFileSync)(`mempool/${m}`, `/tmp/${m}`);
                (0, fs_1.unlinkSync)(`mempool/${m}`);
            });
            blocks--;
            if (blocks === 0) {
                process.exit(0);
            }
        }
    }
}
let first = true;
function mine(header) {
    let p;
    return {
        result: new Promise((r, e) => {
            const args = [header.toString('hex')];
            if (first) {
                first = false;
                args.push('info');
            }
            p = (0, child_process_1.spawn)(config.minerd_binary, args);
            let out = '';
            p.stdout.setEncoding('utf8');
            p.stdout.on('data', data => {
                out += data.toString();
            });
            p.stderr.setEncoding('utf8');
            p.stderr.pipe(process.stderr);
            p.on('close', code => {
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
        }),
        terminate: () => p.kill('SIGTERM'),
    };
}
function signetBlockSighash(header, challenge) {
    const toSpend = new bitcoin.Transaction();
    const toSign = new bitcoin.Transaction();
    toSpend.version = 0;
    toSpend.addInput(Buffer.alloc(32), 0xffffffff, 0);
    toSpend.setInputScript(0, bitcoin.script.compile([bitcoin.opcodes.OP_0, header]));
    toSpend.addOutput(challenge, 0);
    toSign.version = 0;
    toSign.addInput(Buffer.from(toSpend.getId(), 'hex').reverse(), 0, 0);
    toSign.addOutput(bitcoin.script.compile([bitcoin.opcodes.OP_RETURN]), 0);
    return {
        legacy: toSign.hashForSignature(0, challenge, bitcoin.Transaction.SIGHASH_ALL),
        witness_v0: toSign.hashForWitnessV0(0, challenge, 0, bitcoin.Transaction.SIGHASH_ALL),
        witness_v1: toSign.hashForWitnessV1(0, [challenge], [0], bitcoin.Transaction.SIGHASH_DEFAULT),
    };
}
