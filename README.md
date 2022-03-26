# btc_stuff

Bitcoin transaction examples with bitcoinjs-lib

### Dependencies

- A running Bitcoin node
- nodejs
- npm
  - bip32
  - bitcoinjs-lib
  - bs58
  - ecpair
  - tiny-secp256k1
  - zeromq


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
