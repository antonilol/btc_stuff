import { spawn } from 'child_process';
import * as bitcoin from 'bitcoinjs-lib';
import { btc, bech32toScriptPubKey, getBlockTemplate, BlockTemplate, BlockTemplateTX, TemplateRequest, consoleTrace, insertTransaction, removeTransaction, setChain, network } from './btc';
import { merkleRoot } from './merkle_tree';
import { strict as assert } from 'assert';
import { randomBytes } from 'crypto';
import { writeFileSync, unlinkSync, copyFileSync, readFileSync, readdirSync } from 'fs';
import { dirname } from 'path';
import * as curve from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair'

const ECPair = ECPairFactory(curve);

const minerd = `${dirname(process.argv[1])}/cpuminer/minerd`;

// set to false to remove all segwit txs and skip witness commitment
const segwit = true;

// set to true to sign blocks according to BIP325
const signet = false;

if (signet) {
	setChain('signet');
}

// i say DONT CHEAT it is only here for me :)
const cheat = false;

const args = process.argv.slice(2);

var blocks: number = -1;

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
		console.log(`Using block template from ${templateFile}`);
	}
}

function encodeVarUIntLE(n: number): Buffer {
	assert(n >= 0 && n < 2 ** 32);
	var l = 1;
	var b = '8';
	var off = 0;
	var i: number;
	if (n > 0xffff) {
		l = 5;
		b = '32LE';
		off = 1;
		i = 0xfe;
	} else if (n > 0xfc) {
		l = 3;
		b = '16LE';
		off = 1;
		i = 0xfd;
	}
	const buf = Buffer.allocUnsafe(l);
	buf[`writeUInt${b}`](n, off);
	if (off) {
		buf.writeUInt8(i);
	}
	return buf;
}

var templateFile: string | undefined;

// BIP141
const wCommitHeader = Buffer.from('aa21a9ed', 'hex');
// BIP325
const signetHeader = Buffer.from('ecc7daa2', 'hex');

function createCoinbase(address: string, value: number, height: number, txs: BlockTemplateTX[], message: string, extraNonce: Buffer, signetBlockSig?: Buffer) {
	const tx = new bitcoin.Transaction();

	// in
	tx.addInput(Buffer.alloc(32), 0xffffffff);
	tx.setInputScript(0, Buffer.concat([
		bitcoin.script.compile([ bitcoin.script.number.encode(height) ]),
		extraNonce,
		Buffer.from(message)
	]));

	// block reward + fees
	tx.addOutput(bech32toScriptPubKey(address), value);

	const commits: Buffer[] = [];

	if (segwit) {
		// witness commitment
		const wtxids: (string | Buffer)[] = txs.map(x => x.hash);
		wtxids.splice(0, 0, Buffer.alloc(32));
		commits.push(Buffer.concat([
			wCommitHeader,
			bitcoin.crypto.hash256(Buffer.concat([
				merkleRoot(wtxids),
				Buffer.alloc(32)
			]))
		]));

		tx.setWitness(0, [ Buffer.alloc(32) ]);
	}

	if (signet) {
		// signet block signature
		commits.push(Buffer.concat([
			signetHeader,
			signetBlockSig ? signetBlockSig : Buffer.alloc(0)
		]));
	}

	if (commits.length) {
		tx.addOutput(bitcoin.script.compile([
			bitcoin.opcodes.OP_RETURN,
			...commits
		]), 0);
	}

	// serialize
	const coinbase = tx.toBuffer();
	const txid = tx.getId();

	return { tx: coinbase, txid };
}

async function getWork() {
	var t: BlockTemplate;
	if (templateFile) {
		t = JSON.parse(readFileSync(templateFile).toString());
	} else {
		const req: TemplateRequest = { rules: [ 'segwit' ] };
		if (signet) {
			req.rules.push('signet');
		}
		t = await getBlockTemplate(req);
	}

	var time: number;
	if (cheat) {
		const prev = await btc('getblockheader', t.previousblockhash);
		time = JSON.parse(prev).time + 20 * 60 + 1;
	} else {
		time = Math.floor(new Date().getTime() / 1000);
	}

	const txs = t.transactions;

	const mempool = readdirSync('mempool');
	for (const tx of mempool.map(f => readFileSync(`mempool/${f}`).toString().trim())) {
		await insertTransaction(t, tx);
	}

	if (!segwit) {
		var toRemove: BlockTemplateTX;
		var removed = 0;
		while (toRemove = t.transactions.find(x => x.hash != x.txid)) {
			removed += removeTransaction(t, toRemove.txid).length;
		}
		console.log(`SegWit is disabled`);
		console.log(`Excluded ${removed} SegWit transactions from the block`);
	}

	const txcount = encodeVarUIntLE(txs.length + 1);

	const message = ' github.com/antonilol/btc_stuff >> New signet miner! << ';
	const address = 'tb1qllllllxl536racn7h9pew8gae7tyu7d58tgkr3';

	if (!address) {
		consoleTrace.error('No payout address specified!');
		process.exit(1);
	}

	const extraNonce = randomBytes(4);

	var signetBlockSig: Buffer | undefined;

	while (true) {
		const coinbase = createCoinbase(
			address,
			t.coinbasevalue,
			t.height,
			txs,
			message,
			extraNonce,
			signetBlockSig
		);

		var txlen = coinbase.tx.length;
		txs.forEach(tx => {
			txlen += tx.data.length / 2;
		});

		const txoffset = 80 + txcount.length;
		const block = Buffer.allocUnsafe(txoffset + txlen);
		txcount.copy(block, 80);
		coinbase.tx.copy(block, txoffset);
		var o = txoffset + coinbase.tx.length;
		txs.forEach(tx => {
			const data = Buffer.from(tx.data, 'hex');
			data.copy(block, o);
			o += data.length;
		});

		const mRoot = merkleRoot([ coinbase.txid, ...txs.map(x => x.txid) ]);

		block.writeUInt32LE(t.version);
		Buffer.from(t.previousblockhash, 'hex').reverse().copy(block, 4);
		mRoot.copy(block, 36);
		block.writeUInt32LE(time, 68);
		Buffer.from(cheat ? '1d00ffff' : t.bits, 'hex').reverse().copy(block, 72);

		if (!signet || signetBlockSig) {
			return { block, mempool };
		}

		// signing code, change to your own needs
		const sighash = signetBlockSighash(block.slice(0, 72), Buffer.from(t.signet_challenge, 'hex')).legacy;

		const scriptSig = bitcoin.script.compile([
			bitcoin.script.signature.encode(
				ECPair.fromWIF(
					await btc('dumpprivkey', 'tb1qllllllxl536racn7h9pew8gae7tyu7d58tgkr3'),
					network
				).sign(sighash),
				bitcoin.Transaction.SIGHASH_ALL
			)
		]);
		const scriptWitness = Buffer.alloc(1);

		signetBlockSig = Buffer.concat([ encodeVarUIntLE(scriptSig.length), scriptSig, scriptWitness ]);
	}
}

main();

async function main() {
	while (true) {
		const work = await getWork();

		const header = await mine(work.block.slice(0, 76));

		if (header) {
			header.copy(work.block);
			const hash = bitcoin.crypto.hash256(header).reverse().toString('hex');
			console.log(`Found block! ${hash}`);
			const block = work.block.toString('hex');
			writeFileSync(`/tmp/${hash}-${new Date().getTime()}.blk`, block);
			process.stdout.write('submitblock...');
			const p = await btc('submitblock', block);
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
				copyFileSync(`mempool/${m}`,`/tmp/${m}`);
				unlinkSync(`mempool/${m}`);
			});
			blocks--;
			if (blocks === 0) {
				process.exit(0);
			}
		}
	}
}

var first = true;

function mine(header: Buffer): Promise<Buffer | void> {
	return new Promise((r, e) => {
		const args = [ header.toString('hex') ];
		if (first) {
			first = false;
			args.push('info');
		}
		const p = spawn(minerd, args);

		var out = ''

		p.stdout.setEncoding('utf8');
		p.stdout.on('data', data => out += data.toString());

		p.stderr.setEncoding('utf8');
		p.stderr.pipe(process.stderr);

		p.on('close', code => {
			while (out.endsWith('\n')) {
				out = out.slice(0, -1);
			}
			if (code) {
				e(out);
			} else if (out) {
				r(Buffer.from(out, 'hex'));
			} else {
				r();
			}
		});
	});
}

function signetBlockSighash(header: Buffer, challenge: Buffer): { legacy: Buffer, witness_v0: Buffer, witness_v1: Buffer } {
	const toSpend = new bitcoin.Transaction();
	const toSign = new bitcoin.Transaction();

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
		legacy:     toSign.hashForSignature(0, challenge, bitcoin.Transaction.SIGHASH_ALL),
		witness_v0: toSign.hashForWitnessV0(0, challenge, 0, bitcoin.Transaction.SIGHASH_ALL),
		witness_v1: toSign.hashForWitnessV1(0, [ challenge ], [ 0 ], bitcoin.Transaction.SIGHASH_DEFAULT)
	}
}
