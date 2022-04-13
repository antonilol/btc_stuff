# btc_stuff

Bitcoin transaction examples with bitcoinjs-lib

This is a collection of scripts with various aspects of bitcoin in TypeScript and/or JavaScript.
Note that when making changes in TypeScript files you need to compile it again for it to work.

Use at your own risk, only use on the mainnet if you are 100% certain it works the way you want or funds can be lost!

### Usage

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

Choose a script you want to start with. I will use `p2sh.js` here.

If you want, edit something, for example: change `OP_13` to `OP_12`.

Run it

TODO more here

### Network

All script by default use `testnet`. To use another network (for example mainnet):

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
