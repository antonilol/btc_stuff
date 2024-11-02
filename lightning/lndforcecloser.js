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
const bitcoin = __importStar(require("bitcoinjs-lib"));
const btc_1 = require("../btc");
const curve = __importStar(require("tiny-secp256k1"));
const ecpair_1 = require("ecpair");
const bip32_1 = require("bip32");
const child_process_1 = require("child_process");
const os_1 = require("os");
const assert_1 = require("assert");
const channeldb_reader_1 = require("./channeldb_reader");
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
const bip32 = (0, bip32_1.BIP32Factory)(curve);
function swapIfNot(cond, [a, b]) {
    return cond ? [a, b] : [b, a];
}
function msatToSatString(b) {
    const s = b.toString().padStart(4, '0');
    return s.slice(0, -3) + '.' + s.slice(-3);
}
function stripWitness(tx) {
    for (const txin of tx.ins) {
        txin.witness = [];
    }
}
async function commitTxPsbt(channel) {
    const psbt = new bitcoin.Psbt();
    const commit = channel.LocalCommitment.CommitTx;
    const localms = Buffer.from(channel.LocalChanCfg.MultiSigKey.PubKey, 'hex');
    const remotems = Buffer.from(channel.RemoteChanCfg.MultiSigKey.PubKey, 'hex');
    const localFirst = localms < remotems;
    const witnessScript = bitcoin.script.compile([
        0x52,
        ...swapIfNot(localFirst, [localms, remotems]),
        0x52,
        bitcoin.opcodes.OP_CHECKMULTISIG,
    ]);
    // tx version
    psbt.version = commit.Version;
    // add input
    const txin = commit.TxIn[0];
    const funding = bitcoin.Transaction.fromHex(channel.FundingTxn || (await (0, btc_1.btc)('getrawtransaction', txin.PreviousOutPoint.txid)));
    stripWitness(funding);
    psbt.addInput({
        hash: txin.PreviousOutPoint.txidLE,
        index: txin.PreviousOutPoint.vout,
        sequence: txin.Sequence,
        bip32Derivation: swapIfNot(localFirst, [
            {
                pubkey: localms,
                masterFingerprint: Buffer.alloc(4),
                path: channel.LocalChanCfg.MultiSigKey.Path,
            },
            {
                pubkey: remotems,
                masterFingerprint: Buffer.alloc(4),
                path: 'm',
            },
        ]),
        witnessScript,
        nonWitnessUtxo: funding.toBuffer(),
        witnessUtxo: {
            script: bitcoin.script.compile([0, bitcoin.crypto.sha256(witnessScript)]),
            value: channel.Capacity,
        },
    });
    // add outputs
    for (const txout of commit.TxOut) {
        psbt.addOutput({ script: txout.PkScript, value: Number(txout.Value) });
    }
    // tx locktime (encodes half of the obscured commitment number, other half is in the input's sequence)
    psbt.locktime = commit.LockTime;
    psbt.updateInput(0, {
        partialSig: [
            {
                pubkey: remotems,
                signature: Buffer.concat([
                    channel.LocalCommitment.CommitSig,
                    Buffer.from([bitcoin.Transaction.SIGHASH_ALL]),
                ]),
            },
        ],
    });
    return psbt;
}
async function commitTxSigned(channel) {
    const tx = new bitcoin.Transaction();
    const commit = channel.LocalCommitment.CommitTx;
    const localms = Buffer.from(channel.LocalChanCfg.MultiSigKey.PubKey, 'hex');
    const remotems = Buffer.from(channel.RemoteChanCfg.MultiSigKey.PubKey, 'hex');
    const localFirst = localms < remotems;
    const witnessScript = bitcoin.script.compile([
        0x52,
        ...swapIfNot(localFirst, [localms, remotems]),
        0x52,
        bitcoin.opcodes.OP_CHECKMULTISIG,
    ]);
    tx.version = commit.Version;
    for (const txin of commit.TxIn) {
        tx.addInput(txin.PreviousOutPoint.txidLE, txin.PreviousOutPoint.vout, txin.Sequence);
    }
    for (const txout of commit.TxOut) {
        tx.addOutput(txout.PkScript, Number(txout.Value));
    }
    tx.locktime = commit.LockTime;
    const xprv = await (0, btc_1.input)('Get the master private key from your lnd\n' +
        'A useful tool for this is https://guggero.github.io/cryptography-toolkit/#!/aezeed\n' +
        'Enter xprv > ');
    let localpriv;
    try {
        localpriv = bip32.fromBase58(xprv).derivePath(channel.LocalChanCfg.MultiSigKey.Path).privateKey;
        (0, assert_1.strict)(localpriv.length === 32);
    }
    catch (e) {
        console.log('invalid input');
        process.exit(1);
    }
    const keypair = ECPair.fromPrivateKey(localpriv);
    if (localms.compare(keypair.publicKey)) {
        console.log('Derived key does not match public key in the channel.db');
        process.exit(1);
    }
    const remotesig = Buffer.concat([
        channel.LocalCommitment.CommitSig,
        Buffer.from([bitcoin.Transaction.SIGHASH_ALL]),
    ]);
    const localsig = bitcoin.script.signature.encode(keypair.sign(tx.hashForWitnessV0(0, witnessScript, channel.Capacity, bitcoin.Transaction.SIGHASH_ALL)), bitcoin.Transaction.SIGHASH_ALL);
    tx.setWitness(0, [Buffer.alloc(0), ...(localFirst ? [localsig, remotesig] : [remotesig, localsig]), witnessScript]);
    return tx;
}
main();
async function main() {
    const network = await (0, btc_1.input)('Enter network (mainnet or testnet) > ');
    if (network !== 'mainnet' && network !== 'testnet') {
        console.log('invalid input');
        process.exit(1);
    }
    (0, btc_1.setChain)(network === 'mainnet' ? 'main' : 'test');
    const chdbPathLinux = `${(0, os_1.homedir)()}/.lnd/data/graph/${network}/channel.db`;
    const chdbPath = (await (0, btc_1.input)(`Enter channel.db path (defaults to ${chdbPathLinux})`)) || chdbPathLinux;
    console.log('Opening channel.db...');
    let chdb;
    try {
        chdb = (0, child_process_1.execSync)(`chantools dumpchannels --channeldb ${chdbPath}${network === 'testnet' ? ' -t' : ''}`).toString();
    }
    catch (e) {
        process.exit(1);
    }
    chdb = chdb.slice(chdb.indexOf('([]dump.OpenChannel)'));
    const channels = (0, channeldb_reader_1.parseChannelDB)(chdb);
    console.log(`Found ${channels.length} channels in channel.db`);
    if (!channels.length) {
        process.exit();
    }
    channels.forEach((ch, i) => {
        console.log(`#${i}:`, `scid=${ch.ShortChannelID.string} (${ch.ShortChannelID.raw}),`, `capacity=${ch.Capacity} sat,`, `balance=${msatToSatString(ch.LocalCommitment.LocalBalance)} sat (~${((Number(ch.LocalCommitment.LocalBalance) / 1000 / ch.Capacity) *
            100).toFixed(1)}%),`, `HTLCs=${ch.LocalCommitment.Htlcs.length}`);
    });
    const channel = channels[Number(await (0, btc_1.input)('Choose a channel > #'))];
    if (!channel) {
        console.log('invalid input');
        process.exit(1);
    }
    const a = await (0, btc_1.input)('Sign the commitment transaction or produce psbt?\nEnter "tx" or "psbt" > ');
    if (a !== 'tx' && a !== 'psbt') {
        console.log('invalid input');
        process.exit(1);
    }
    if (a === 'tx') {
        console.log((await commitTxSigned(channel)).toHex());
    }
    else if (a === 'psbt') {
        console.log((await commitTxPsbt(channel)).toBase64());
    }
}
