# btc_stuff

Bitcoin transaction examples with bitcoinjs-lib

This is a collection of scripts with various aspects of bitcoin tech (mostly scripts) in TypeScript and/or JavaScript.
<br>
When dealing with TypeScript files, run `npm run build` before running them with `node <file>`, or use `ts-node <file>`.

**(!) Use at your own risk, only use on the mainnet if you are 100% certain it works the way you want or funds can be lost! (!)**

Developed mostly using Bitcoin Core v23, some older ones could expect v22 RPCs

### Example usage

Note: this example still works for some files, but is subject to change

Requirements:
Make sure to have
- a bitcoin node synced and running on the desired network/networks
- `bitcoin-cli` working
- nodejs and npm installed and working

Clone this repository, `cd` into it and install npm dependencies.
```bash
git clone https://github.com/antonilol/btc_stuff.git
cd btc_stuff
npm install
```

Choose a script you want to start with.
I will use [p2sh.js](./p2sh.js) here.

Edit something (optional), for example: change `OP_13` to `OP_12`.

Run it

Most scripts will either output a locking script or an address,
in this case it is a locking script, so put this locking script
in Bitcoin Core's `decodescript` rpc.

```bash
$ bitcoin-cli -testnet decodescript 935c87
{
  "asm": "OP_ADD 12 OP_EQUAL",
  "type": "nonstandard",
  "p2sh": "2N9h3wvypp2oLaaGfHiDVix5GSeTPMGnhQv",
  "segwit": {
    "asm": "0 a5d2c3f6d91680a99d36ef8ba054a57ab220520f7ebe93ddb56316f85f292315",
    "hex": "0020a5d2c3f6d91680a99d36ef8ba054a57ab220520f7ebe93ddb56316f85f292315",
    "address": "tb1q5hfv8akez6q2n8fka796q49902ezq5s006lf8hd4vvt0shefyv2sw96epz",
    "type": "witness_v0_scripthash",
    "p2sh-segwit": "2NCqyYd7K5K9pj6SiUXV65NV5baZNvtfxPE"
  }
}
```

We will be using the address next to `p2sh`: `2N9h3wvypp2oLaaGfHiDVix5GSeTPMGnhQv`.

Send some sats to this address, 1000 for example:

```bash
$ bitcoin-cli -testnet sendtoaddress 2N9h3wvypp2oLaaGfHiDVix5GSeTPMGnhQv 0.00001000
ae70f2d7625184471c9bbf3dea64febc5b562131f2b7c6ccbf3125d493402ac1
```

This will give a TXID, look this up on a block explorer to find out where the desired output is.

You need to look for the _output index_, where the output with this P2SH address is, counting from zero.

(If it is the first output, the output index is 0, if it is the second, it is 1 and so on.)

Now go back to your editor and put the TXID and the output index in.

It will look like this:

```js
const txid = 'ae70f2d7625184471c9bbf3dea64febc5b562131f2b7c6ccbf3125d493402ac1'; // txid hex here
const vout = 1;
```

We also need to change the input script because we changed the value from 13 to 12.

The script `OP_ADD 12 OP_EQUAL` expects 2 numbers that add up to 12, i will chose 4 and 8 here.

```js
tx.setInputScript(0, bitcoin.script.compile([
	bitcoin.opcodes.OP_4,
	bitcoin.opcodes.OP_8,
	redeemScript
]));
```

Some other values need to be set too, like
`input_sat` to how much sats you sent to the address,
`fee_sat` to how much fee you want to pay and
put your own receiving address of a wallet over the placeholder `tb1qbech32addresshere`.

Now by running the script it should create and broadcast your transaction and print its TXID to the console.
This TXID can also be looked up in a block explorer.
([mempool.space](https://mempool.space) and [blockstream.info](https://blockstream.info) have a
`Details` button to show advanced details about scripts.)

If you have any questions, found bugs or have an improvement/addition feel free to submit it
in either issues, discussions or pull requests.

### Network

Almost all scripts by default use `testnet`. To use another network (for example mainnet):

add
```js
setChain('main'); // Where 'main' can be replaced by 'test', 'signet' or 'regtest'
```
(`setChain` may need to be imported from `./btc.js`)

and if applicable (not all script use `bitcoinjs-lib`), change
```js
const network = bitcoin.networks.testnet;
```
to
```js
const network = bitcoin.networks.bitcoin; // Where bitcoin can be replaced by testnet or regtest.
                                          // For signet, use testnet (they use the same address prefix).
```
