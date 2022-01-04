# btc_stuff

A repository with standalone JavaScript files (except library file [btc.js](https://github.com/antonilol/btc_stuff/blob/master/btc.js)).


#### Dependencies

- A running Bitcoin node
- nodejs
- npm
  - bitcoinjs-lib
  - ecpair
  - tiny-secp256k1


#### Network

All script by default use `testnet`. To use another network (for example mainnet):

change
```js
require('./btc')();
```
to
```js
require('./btc')('main'); // Where 'main' can be replaced by 'test', 'signet' or 'regtest'
```

and if applicable (not all script use `bitcoinjs-lib`), change
```js
const network = bitcoin.networks.testnet;
```
to
```js
const network = bitcoin.networks.bitcoin; // Where bitcoin can be replaced by testnet or regtest.
                                          // For signet, use testnet (they use the same address prefix).
```
