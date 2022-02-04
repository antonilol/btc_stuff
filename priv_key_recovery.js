const bitcoin = require('bitcoinjs-lib');
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));

const base58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('');

// Oops, i lost some characters of my key!
var key = '*4***hvLC1b4ag9L2PM9kRicQxUoYT1Q36PQ21Y*LNkrAdWZNos6';

const compr = key.length == 52;
const lead = compr ? [ 'L', 'K' ] : [ '5' ];

check(key);

function check(k) {
	const i = k.indexOf('*');
	if (i != -1) {
		(i ? base58chars : lead).forEach(c => check(k.replace(/\*/, c)));
	} else {
		try {
			ECPair.fromWIF(k);
			console.log(`Key found: ${k}`);
			process.exit(0);
		}
		catch (e) {
		}
	}
}
