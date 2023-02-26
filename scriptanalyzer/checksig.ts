const SIGHASH_DEFAULT = 0;
const SIGHASH_ALL = 1;
const SIGHASH_NONE = 2;
const SIGHASH_SINGLE = 3;
const SIGHASH_ANYONECANPAY = 128;
/** hash types that can appear at the end of a signature (SIGHASH_DEFAULT can't) */
const sigHashTypes = [
	SIGHASH_ALL,
	SIGHASH_NONE,
	SIGHASH_SINGLE,
	SIGHASH_ALL | SIGHASH_ANYONECANPAY,
	SIGHASH_NONE | SIGHASH_ANYONECANPAY,
	SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
];

function pubkeyType(pubkey: Uint8Array): { valid: false } | { valid: true; compressed: boolean } {
	if (pubkey.length === 33 && (pubkey[0] === 0x02 || pubkey[0] === 0x03)) {
		return { valid: true, compressed: true };
	} else if (pubkey.length === 65 && pubkey[0] === 0x04) {
		return { valid: true, compressed: false };
	}
	return { valid: false };
}

// The following function was copied from the Bitcoin Core source code, src/script/interpreter (lines 97-170) at b92d609fb25637ccda000e182da854d4b762eee9
// Edited for TypeScript use

// Orignal Bitcoin Core copyright header:
// Copyright (c) 2009-2010 Satoshi Nakamoto
// Copyright (c) 2009-2022 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

/**
 * A canonical signature exists of: <30> <total len> <02> <len R> <R> <02> <len S> <S> <hashtype>
 * Where R and S are not negative (their first byte has its highest bit not set), and not
 * excessively padded (do not start with a 0 byte, unless an otherwise negative number follows,
 * in which case a single 0 byte is necessary and even required).
 *
 * See https://bitcointalk.org/index.php?topic=8392.msg127623#msg127623
 *
 * This function is consensus-critical since BIP66.
 */
function isValidSignatureEncoding(sig: Uint8Array) {
	// Format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S] [sighash]
	// * total-length: 1-byte length descriptor of everything that follows,
	//   excluding the sighash byte.
	// * R-length: 1-byte length descriptor of the R value that follows.
	// * R: arbitrary-length big-endian encoded R value. It must use the shortest
	//   possible encoding for a positive integer (which means no null bytes at
	//   the start, except a single one when the next byte has its highest bit set).
	// * S-length: 1-byte length descriptor of the S value that follows.
	// * S: arbitrary-length big-endian encoded S value. The same rules apply.
	// * sighash: 1-byte value indicating what data is hashed (not part of the DER
	//   signature)

	// Minimum and maximum size constraints.
	if (sig.length < 9) return false;
	if (sig.length > 73) return false;

	// A signature is of type 0x30 (compound).
	if (sig[0] != 0x30) return false;

	// Make sure the length covers the entire signature.
	if (sig[1] != sig.length - 3) return false;

	// Extract the length of the R element.
	const lenR = sig[3];

	// Make sure the length of the S element is still inside the signature.
	if (5 + lenR >= sig.length) return false;

	// Extract the length of the S element.
	const lenS = sig[5 + lenR];

	// Verify that the length of the signature matches the sum of the length
	// of the elements.
	if (lenR + lenS + 7 != sig.length) return false;

	// Check whether the R element is an integer.
	if (sig[2] != 0x02) return false;

	// Zero-length integers are not allowed for R.
	if (lenR == 0) return false;

	// Negative numbers are not allowed for R.
	if (sig[4] & 0x80) return false;

	// Null bytes at the start of R are not allowed, unless R would
	// otherwise be interpreted as a negative number.
	if (lenR > 1 && sig[4] == 0x00 && !(sig[5] & 0x80)) return false;

	// Check whether the S element is an integer.
	if (sig[lenR + 4] != 0x02) return false;

	// Zero-length integers are not allowed for S.
	if (lenS == 0) return false;

	// Negative numbers are not allowed for S.
	if (sig[lenR + 6] & 0x80) return false;

	// Null bytes at the start of S are not allowed, unless S would otherwise be
	// interpreted as a negative number.
	if (lenS > 1 && sig[lenR + 6] == 0x00 && !(sig[lenR + 7] & 0x80)) return false;

	return true;
}
