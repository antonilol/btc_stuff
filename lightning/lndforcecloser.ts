import * as bitcoin from 'bitcoinjs-lib';
import { btc, setChain, input } from '../btc';
import * as curve from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { BIP32Factory } from 'bip32';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { strict as assert } from 'assert';

import { parseChannelDB, Channel } from './channeldb_reader';

const ECPair = ECPairFactory(curve);
const bip32 = BIP32Factory(curve);

function swapIfNot<A, B>(cond: true, [ a, b ]: [A, B]): [A, B];
function swapIfNot<A, B>(cond: false, [ a, b ]: [A, B]): [B, A];
function swapIfNot<A, B>(cond: boolean, [ a, b ]: [A, B]): [A, B] | [B, A];
function swapIfNot<A, B>(cond: boolean, [ a, b ]: [A, B]): [A, B] | [B, A] {
	return cond ? [ a, b ] : [ b, a ];
}

function msatToSatString(b: bigint): string {
	const s = b.toString().padStart(4, '0');
	return s.slice(0, -3) + '.' + s.slice(-3);
}

function stripWitness(tx: bitcoin.Transaction): void {
	for (const txin of tx.ins) {
		txin.witness = [];
	}
}

async function commitTxPsbt(channel: Channel): Promise<bitcoin.Psbt> {
	const psbt = new bitcoin.Psbt();

	const commit = channel.LocalCommitment.CommitTx;

	const localms = Buffer.from(channel.LocalChanCfg.MultiSigKey.PubKey, 'hex');
	const remotems = Buffer.from(channel.RemoteChanCfg.MultiSigKey.PubKey, 'hex');

	const localFirst = localms < remotems;

	const witnessScript = bitcoin.script.compile([
		0x52,
		...swapIfNot(localFirst, [ localms, remotems ]),
		0x52,
		bitcoin.opcodes.OP_CHECKMULTISIG
	]);

	// tx version
	psbt.version = commit.Version;

	// add input
	const txin = commit.TxIn[0];
	const funding = bitcoin.Transaction.fromHex(
		channel.FundingTxn || (await btc('getrawtransaction', txin.PreviousOutPoint.txid))
	);

	stripWitness(funding);

	psbt.addInput({
		hash: txin.PreviousOutPoint.txidLE,
		index: txin.PreviousOutPoint.vout,
		sequence: txin.Sequence,
		bip32Derivation: swapIfNot(localFirst, [
			{
				pubkey: localms,
				masterFingerprint: Buffer.alloc(4),
				path: channel.LocalChanCfg.MultiSigKey.Path
			},
			{
				pubkey: remotems,
				masterFingerprint: Buffer.alloc(4),
				path: 'm'
			}
		]),
		witnessScript,
		nonWitnessUtxo: funding.toBuffer(),
		witnessUtxo: {
			script: bitcoin.script.compile([ 0, bitcoin.crypto.sha256(witnessScript) ]),
			value: channel.Capacity
		}
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
				signature: Buffer.concat([ channel.LocalCommitment.CommitSig, Buffer.from([ bitcoin.Transaction.SIGHASH_ALL ]) ])
			}
		]
	});

	return psbt;
}

async function commitTxSigned(channel: Channel): Promise<bitcoin.Transaction> {
	const tx = new bitcoin.Transaction();

	const commit = channel.LocalCommitment.CommitTx;

	const localms = Buffer.from(channel.LocalChanCfg.MultiSigKey.PubKey, 'hex');
	const remotems = Buffer.from(channel.RemoteChanCfg.MultiSigKey.PubKey, 'hex');

	const localFirst = localms < remotems;

	const witnessScript = bitcoin.script.compile([
		0x52,
		...swapIfNot(localFirst, [ localms, remotems ]),
		0x52,
		bitcoin.opcodes.OP_CHECKMULTISIG
	]);

	tx.version = commit.Version;

	for (const txin of commit.TxIn) {
		tx.addInput(txin.PreviousOutPoint.txidLE, txin.PreviousOutPoint.vout, txin.Sequence);
	}

	for (const txout of commit.TxOut) {
		tx.addOutput(txout.PkScript, Number(txout.Value));
	}

	tx.locktime = commit.LockTime;

	const xprv = await input(
		'Get the master private key from your lnd\n' +
			'A useful tool for this is https://guggero.github.io/cryptography-toolkit/#!/aezeed\n' +
			'Enter xprv > '
	);

	let localpriv: Buffer;
	try {
		localpriv = bip32.fromBase58(xprv).derivePath(channel.LocalChanCfg.MultiSigKey.Path).privateKey;
		assert(localpriv.length === 32);
	} catch (e) {
		console.log('invalid input');
		process.exit(1);
	}

	const keypair = ECPair.fromPrivateKey(localpriv);
	if (localms.compare(keypair.publicKey)) {
		console.log('Derived key does not match public key in the channel.db');
		process.exit(1);
	}

	const remotesig = Buffer.concat([ channel.LocalCommitment.CommitSig, Buffer.from([ bitcoin.Transaction.SIGHASH_ALL ]) ]);

	const localsig = bitcoin.script.signature.encode(
		keypair.sign(tx.hashForWitnessV0(0, witnessScript, channel.Capacity, bitcoin.Transaction.SIGHASH_ALL)),
		bitcoin.Transaction.SIGHASH_ALL
	);

	tx.setWitness(0, [ Buffer.alloc(0), ...(localFirst ? [ localsig, remotesig ] : [ remotesig, localsig ]), witnessScript ]);

	return tx;
}

main();
async function main() {
	const network = await input('Enter network (mainnet or testnet) > ');
	if (network !== 'mainnet' && network !== 'testnet') {
		console.log('invalid input');
		process.exit(1);
	}

	setChain(network === 'mainnet' ? 'main' : 'test');
	const chdbPathLinux = `${homedir()}/.lnd/data/graph/${network}/channel.db`;
	const chdbPath = (await input(`Enter channel.db path (defaults to ${chdbPathLinux})`)) || chdbPathLinux;

	console.log('Opening channel.db...');
	let chdb: string;
	try {
		chdb = execSync(`chantools dumpchannels --channeldb ${chdbPath}${network === 'testnet' ? ' -t' : ''}`).toString();
	} catch (e) {
		process.exit(1);
	}

	chdb = chdb.slice(chdb.indexOf('([]dump.OpenChannel)'));

	const channels = parseChannelDB(chdb);

	console.log(`Found ${channels.length} channels in channel.db`);
	if (!channels.length) {
		process.exit();
	}
	channels.forEach((ch, i) => {
		console.log(
			`#${i}:`,
			`scid=${ch.ShortChannelID.string} (${ch.ShortChannelID.raw}),`,
			`capacity=${ch.Capacity} sat,`,
			`balance=${msatToSatString(ch.LocalCommitment.LocalBalance)} sat (~${(
				(Number(ch.LocalCommitment.LocalBalance) / 1000 / ch.Capacity) *
				100
			).toFixed(1)}%),`,
			`HTLCs=${ch.LocalCommitment.Htlcs.length}`
		);
	});

	const channel = channels[Number(await input('Choose a channel > #'))];
	if (!channel) {
		console.log('invalid input');
		process.exit(1);
	}

	const a = await input('Sign the commitment transaction or produce psbt?\nEnter "tx" or "psbt" > ');
	if (a !== 'tx' && a !== 'psbt') {
		console.log('invalid input');
		process.exit(1);
	}

	if (a === 'tx') {
		console.log((await commitTxSigned(channel)).toHex());
	} else if (a === 'psbt') {
		console.log((await commitTxPsbt(channel)).toBase64());
	}
}
