// From the Bitcoin Core source code, files src/script/script_error.{h,cpp} at commit b1a2021f78099c17360dc2179cbcb948059b5969
// Edited for TypeScript use

// Orignal Bitcoin Core copyright header:
// Copyright (c) 2009-2010 Satoshi Nakamoto
// Copyright (c) 2009-2020 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

enum ScriptError {
	SCRIPT_ERR_OK = 0,
	SCRIPT_ERR_UNKNOWN_ERROR,
	SCRIPT_ERR_EVAL_FALSE,
	SCRIPT_ERR_OP_RETURN,

	/* Max sizes */
	SCRIPT_ERR_SCRIPT_SIZE,
	SCRIPT_ERR_PUSH_SIZE,
	SCRIPT_ERR_OP_COUNT,
	SCRIPT_ERR_STACK_SIZE,
	SCRIPT_ERR_SIG_COUNT,
	SCRIPT_ERR_PUBKEY_COUNT,

	/* Failed verify operations */
	SCRIPT_ERR_VERIFY,
	SCRIPT_ERR_EQUALVERIFY,
	SCRIPT_ERR_CHECKMULTISIGVERIFY,
	SCRIPT_ERR_CHECKSIGVERIFY,
	SCRIPT_ERR_NUMEQUALVERIFY,

	/* Logical/Format/Canonical errors */
	SCRIPT_ERR_BAD_OPCODE,
	SCRIPT_ERR_DISABLED_OPCODE,
	SCRIPT_ERR_INVALID_STACK_OPERATION,
	SCRIPT_ERR_INVALID_ALTSTACK_OPERATION,
	SCRIPT_ERR_UNBALANCED_CONDITIONAL,

	/* CHECKLOCKTIMEVERIFY and CHECKSEQUENCEVERIFY */
	SCRIPT_ERR_NEGATIVE_LOCKTIME,
	SCRIPT_ERR_UNSATISFIED_LOCKTIME,

	/* Malleability */
	SCRIPT_ERR_SIG_HASHTYPE,
	SCRIPT_ERR_SIG_DER,
	SCRIPT_ERR_MINIMALDATA,
	SCRIPT_ERR_SIG_PUSHONLY,
	SCRIPT_ERR_SIG_HIGH_S,
	SCRIPT_ERR_SIG_NULLDUMMY,
	SCRIPT_ERR_PUBKEYTYPE,
	SCRIPT_ERR_CLEANSTACK,
	SCRIPT_ERR_MINIMALIF,
	SCRIPT_ERR_SIG_NULLFAIL,

	/* softfork safeness */
	SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS,
	SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM,
	SCRIPT_ERR_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION,
	SCRIPT_ERR_DISCOURAGE_OP_SUCCESS,
	SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE,

	/* segregated witness */
	SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH,
	SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY,
	SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH,
	SCRIPT_ERR_WITNESS_MALLEATED,
	SCRIPT_ERR_WITNESS_MALLEATED_P2SH,
	SCRIPT_ERR_WITNESS_UNEXPECTED,
	SCRIPT_ERR_WITNESS_PUBKEYTYPE,

	/* Taproot */
	SCRIPT_ERR_SCHNORR_SIG_SIZE,
	SCRIPT_ERR_SCHNORR_SIG_HASHTYPE,
	SCRIPT_ERR_SCHNORR_SIG,
	SCRIPT_ERR_TAPROOT_WRONG_CONTROL_SIZE,
	SCRIPT_ERR_TAPSCRIPT_VALIDATION_WEIGHT,
	SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG,
	SCRIPT_ERR_TAPSCRIPT_MINIMALIF,

	/* Constant scriptCode */
	SCRIPT_ERR_OP_CODESEPARATOR,
	SCRIPT_ERR_SIG_FINDANDDELETE,

	SCRIPT_ERR_ERROR_COUNT,
	SCRIPT_ERR_LAST = SCRIPT_ERR_ERROR_COUNT,

	// bitcoin core returns unknown error for this one so added it myself
	SCRIPT_ERR_NUM_OVERFLOW
	//
}

function scriptErrorString(serror: ScriptError) {
	switch (serror) {
		case ScriptError.SCRIPT_ERR_OK:
			return 'No error';
		case ScriptError.SCRIPT_ERR_EVAL_FALSE:
			return 'Script evaluated without error but finished with a false/empty top stack element';
		case ScriptError.SCRIPT_ERR_VERIFY:
			return 'Script failed an OP_VERIFY operation';
		case ScriptError.SCRIPT_ERR_EQUALVERIFY:
			return 'Script failed an OP_EQUALVERIFY operation';
		case ScriptError.SCRIPT_ERR_CHECKMULTISIGVERIFY:
			return 'Script failed an OP_CHECKMULTISIGVERIFY operation';
		case ScriptError.SCRIPT_ERR_CHECKSIGVERIFY:
			return 'Script failed an OP_CHECKSIGVERIFY operation';
		case ScriptError.SCRIPT_ERR_NUMEQUALVERIFY:
			return 'Script failed an OP_NUMEQUALVERIFY operation';
		case ScriptError.SCRIPT_ERR_SCRIPT_SIZE:
			return 'Script is too big';
		case ScriptError.SCRIPT_ERR_PUSH_SIZE:
			return 'Push value size limit exceeded';
		case ScriptError.SCRIPT_ERR_OP_COUNT:
			return 'Operation limit exceeded';
		case ScriptError.SCRIPT_ERR_STACK_SIZE:
			return 'Stack size limit exceeded';
		case ScriptError.SCRIPT_ERR_SIG_COUNT:
			return 'Signature count negative or greater than pubkey count';
		case ScriptError.SCRIPT_ERR_PUBKEY_COUNT:
			return 'Pubkey count negative or limit exceeded';
		case ScriptError.SCRIPT_ERR_BAD_OPCODE:
			return 'Opcode missing or not understood';
		case ScriptError.SCRIPT_ERR_DISABLED_OPCODE:
			return 'Attempted to use a disabled opcode';
		case ScriptError.SCRIPT_ERR_INVALID_STACK_OPERATION:
			return 'Operation not valid with the current stack size';
		case ScriptError.SCRIPT_ERR_INVALID_ALTSTACK_OPERATION:
			return 'Operation not valid with the current altstack size';
		case ScriptError.SCRIPT_ERR_OP_RETURN:
			return 'OP_RETURN was encountered';
		case ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL:
			return 'Invalid OP_IF construction';
		case ScriptError.SCRIPT_ERR_NEGATIVE_LOCKTIME:
			return 'Negative locktime';
		case ScriptError.SCRIPT_ERR_UNSATISFIED_LOCKTIME:
			return 'Locktime requirement not satisfied';
		case ScriptError.SCRIPT_ERR_SIG_HASHTYPE:
			return 'Signature hash type missing or not understood';
		case ScriptError.SCRIPT_ERR_SIG_DER:
			return 'Non-canonical DER signature';
		case ScriptError.SCRIPT_ERR_MINIMALDATA:
			return 'Data push larger than necessary';
		case ScriptError.SCRIPT_ERR_SIG_PUSHONLY:
			return 'Only push operators allowed in signatures';
		case ScriptError.SCRIPT_ERR_SIG_HIGH_S:
			return 'Non-canonical signature: S value is unnecessarily high';
		case ScriptError.SCRIPT_ERR_SIG_NULLDUMMY:
			return 'Dummy CHECKMULTISIG argument must be zero';
		case ScriptError.SCRIPT_ERR_MINIMALIF:
			return 'OP_IF/NOTIF argument must be minimal';
		case ScriptError.SCRIPT_ERR_SIG_NULLFAIL:
			return 'Signature must be zero for failed CHECK(MULTI)SIG operation';
		case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS:
			return 'NOPx reserved for soft-fork upgrades';
		case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM:
			return 'Witness version reserved for soft-fork upgrades';
		case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION:
			return 'Taproot version reserved for soft-fork upgrades';
		case ScriptError.SCRIPT_ERR_DISCOURAGE_OP_SUCCESS:
			return 'OP_SUCCESSx reserved for soft-fork upgrades';
		case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE:
			return 'Public key version reserved for soft-fork upgrades';
		case ScriptError.SCRIPT_ERR_PUBKEYTYPE:
			return 'Public key is neither compressed or uncompressed';
		case ScriptError.SCRIPT_ERR_CLEANSTACK:
			return 'Stack size must be exactly one after execution';
		case ScriptError.SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH:
			return 'Witness program has incorrect length';
		case ScriptError.SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY:
			return 'Witness program was passed an empty witness';
		case ScriptError.SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH:
			return 'Witness program hash mismatch';
		case ScriptError.SCRIPT_ERR_WITNESS_MALLEATED:
			return 'Witness requires empty scriptSig';
		case ScriptError.SCRIPT_ERR_WITNESS_MALLEATED_P2SH:
			return 'Witness requires only-redeemscript scriptSig';
		case ScriptError.SCRIPT_ERR_WITNESS_UNEXPECTED:
			return 'Witness provided for non-witness script';
		case ScriptError.SCRIPT_ERR_WITNESS_PUBKEYTYPE:
			return 'Using non-compressed keys in segwit';
		case ScriptError.SCRIPT_ERR_SCHNORR_SIG_SIZE:
			return 'Invalid Schnorr signature size';
		case ScriptError.SCRIPT_ERR_SCHNORR_SIG_HASHTYPE:
			return 'Invalid Schnorr signature hash type';
		case ScriptError.SCRIPT_ERR_SCHNORR_SIG:
			return 'Invalid Schnorr signature';
		case ScriptError.SCRIPT_ERR_TAPROOT_WRONG_CONTROL_SIZE:
			return 'Invalid Taproot control block size';
		case ScriptError.SCRIPT_ERR_TAPSCRIPT_VALIDATION_WEIGHT:
			return 'Too much signature validation relative to witness weight';
		case ScriptError.SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG:
			return 'OP_CHECKMULTISIG(VERIFY) is not available in tapscript';
		case ScriptError.SCRIPT_ERR_TAPSCRIPT_MINIMALIF:
			return 'OP_IF/NOTIF argument must be minimal in tapscript';
		case ScriptError.SCRIPT_ERR_OP_CODESEPARATOR:
			return 'Using OP_CODESEPARATOR in non-witness script';
		case ScriptError.SCRIPT_ERR_SIG_FINDANDDELETE:
			return 'Signature is found in scriptCode';
		// bitcoin core returns unknown error for this one so added it myself
		case ScriptError.SCRIPT_ERR_NUM_OVERFLOW:
			return 'Script number overflow';
		//
		case ScriptError.SCRIPT_ERR_UNKNOWN_ERROR:
		case ScriptError.SCRIPT_ERR_ERROR_COUNT:
		default:
			break;
	}
	return 'unknown error';
}
