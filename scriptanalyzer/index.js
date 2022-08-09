var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/*
const rules = {
    legacy: {
        // script.size() > 10000  ==> error
    },
    witnessscript: {
        // script.size() > 10000  ==> error
        // minimal if (policy)
    },
    tapscript: {
        // minimal if
        // csa, but no OP_CHECKMULTISIG
    }
};
*/
var html = {
    asm: document.getElementById('asm'),
    asmError: document.getElementById('asm-error'),
    hex: document.getElementById('hex'),
    hexError: document.getElementById('hex-error'),
    analysis: document.getElementById('analysis')
};
[html.asm, html.hex].forEach(function (el) {
    return el.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            var start = this.selectionStart;
            var end = this.selectionEnd;
            var val = this.value;
            this.value = val.substring(0, start) + '\t' + val.substring(end);
            this.selectionStart = start + 1;
            this.selectionEnd = start + 1;
        }
    });
});
['keydown', 'keypress', 'keyup'].forEach(function (a) {
    html.asm.addEventListener(a, function () {
        html.asmError.innerText = asmtohex();
        hextoasm(true);
    });
    html.hex.addEventListener(a, function () {
        html.hexError.innerText = hextoasm();
    });
});
function asmtohex() {
    var src = html.asm.value.split(/[ \t\n]+/).filter(function (x) { return x; });
    var script = '';
    for (var _i = 0, src_1 = src; _i < src_1.length; _i++) {
        var op = src_1[_i];
        if (/^(|-)[0-9]+$/.test(op)) {
            var n = parseInt(op);
            if (n === 0) {
                // OP_0
                script += '00';
            }
            else if (n >= -1 && n <= 16) {
                // OP_1NEGATE (4f), OP_1 (51) ... OP_16 (60)
                script += (0x50 + n).toString(16);
            }
            else {
                if (Math.abs(n) > 0x7fffffff) {
                    return 'Too large decimal integer';
                }
                var s = ScriptConv.Int.encode(n);
                script += Util.intEncodeLEHex(s.length, 1) + Util.bufferToHex(s);
            }
        }
        else if (/^<[0-9a-fA-F]*>$/.test(op)) {
            var hex = op.slice(1, -1).toLowerCase();
            if (hex.length & 1) {
                return 'Odd amount of characters in hex literal';
            }
            var l = hex.length / 2;
            if (l <= 75) {
                script += Util.intEncodeLEHex(l, 1);
            }
            else if (l <= 0xff) {
                // OP_PUSHDATA1
                script += '4c' + Util.intEncodeLEHex(l, 1);
            }
            else if (l <= 520) {
                // OP_PUSHDATA2
                script += '4d' + Util.intEncodeLEHex(l, 2);
            }
            else {
                return 'Data push too large';
            }
            script += hex;
        }
        else {
            var opcode = opcodes[op.toUpperCase()] || opcodes['OP_' + op.toUpperCase()];
            if (opcode === undefined) {
                return ('Unknown opcode ' +
                    op +
                    (/^[0-9a-fA-F]+$/.test(op) ? '. If you tried to push hex data, encapsulate it with < and >' : ''));
            }
            if (/PUSHDATA(1|2|4)$/.test(op.toUpperCase())) {
                return 'OP_PUSHDATA is not allowed is Bitcoin ASM script';
            }
            script += Util.intEncodeLEHex(opcode, 1);
        }
    }
    html.hex.value = script;
    html.hexError.innerText = '';
    return '';
}
function hextoasm(analyzeOnly) {
    if (analyzeOnly === void 0) { analyzeOnly = false; }
    var v = html.hex.value.replace(/[ \t\n]+/g, '').toLowerCase();
    if (!analyzeOnly) {
        if (!/^[0-9a-f]*$/.test(v)) {
            return 'Illegal characters in hex literal';
        }
        if (v.length % 2) {
            return 'Odd amount of characters in hex literal';
        }
    }
    var bytes = Util.hexToBuffer(v);
    var script = [];
    var a = [];
    for (var offset = 0; offset < bytes.length;) {
        var b = bytes[offset++];
        var op = getOpcode(b);
        if (op) {
            if (op.startsWith('OP_PUSHDATA')) {
                var n = parseInt(op.match(/1|2|4/)[0]);
                var l = Util.intDecodeLE(bytes.subarray(offset, offset + n));
                offset += n;
                if (l > 520) {
                    return 'Data push too large';
                }
                var data = bytes.subarray(offset, offset + l);
                offset += l;
                if (!analyzeOnly) {
                    if (data.length != l) {
                        return 'Invalid length, expected ' + l + ' but got ' + data.length;
                    }
                    script.push(Util.scriptElemToHex(data));
                }
                a.push(data);
            }
            else {
                if (!analyzeOnly) {
                    if (b === 0) {
                        script.push('0');
                    }
                    else if ((b >= opcodes.OP_1 && b <= opcodes.OP_16) || b === opcodes.OP_1NEGATE) {
                        script.push('' + (b - 0x50));
                    }
                    else {
                        script.push(op);
                    }
                }
                a.push(b);
            }
        }
        else if (b <= 75) {
            var data = bytes.subarray(offset, offset + b);
            offset += b;
            if (!analyzeOnly) {
                if (data.length != b) {
                    return 'Invalid length, expected ' + b + ' but got ' + data.length;
                }
                if (b <= 4) {
                    script.push('' + ScriptConv.Int.decode(data));
                }
                else {
                    script.push(Util.scriptElemToHex(data));
                }
            }
            a.push(data);
        }
        else if (!analyzeOnly) {
            return 'Invalid opcode 0x' + b.toString(16).padStart(2, '0');
        }
    }
    ScriptAnalyzer.analyzeScript(a);
    if (analyzeOnly) {
        return;
    }
    html.asm.value = script.join('\n');
    html.asmError.innerText = '';
    return '';
}
var ElementType;
(function (ElementType) {
    /** Only for minimal encoded booleans. Has 2 possible values: <> and <01> */
    ElementType[ElementType["Bool"] = 0] = "Bool";
    /** Any stack element not larger than 4 bytes */
    ElementType[ElementType["Number"] = 1] = "Number";
})(ElementType || (ElementType = {}));
var ScriptAnalyzer = /** @class */ (function () {
    function ScriptAnalyzer(arg) {
        this.stack = [];
        this.altstack = [];
        this.spendingConditions = [];
        this.varCounter = 0;
        this.scriptOffset = 0;
        this.path = 0;
        this.branches = [];
        if (arg instanceof ScriptAnalyzer) {
            this.stack = arg.stack;
            this.altstack = arg.altstack;
            this.spendingConditions = arg.spendingConditions;
            this.varCounter = arg.varCounter;
            this.script = arg.script;
            this.scriptOffset = arg.scriptOffset;
            this.path = arg.path + 1;
        }
        else {
            this.script = arg;
        }
    }
    /** Pass an array of (Uint8Array | number) where a Uint8Array is a data push and a number is an opcode */
    ScriptAnalyzer.analyzeScript = function (script) {
        for (var _i = 0, script_1 = script; _i < script_1.length; _i++) {
            var op = script_1[_i];
            if (typeof op === 'number' && disabledOpcodes.includes(op)) {
                return scriptErrorString(ScriptError.SCRIPT_ERR_DISABLED_OPCODE);
            }
        }
        var analyzer = new ScriptAnalyzer(script);
        var out = analyzer.analyze();
        if (typeof out === 'number') {
            console.log('spending path error:', scriptErrorString(out), analyzer.stack);
            return;
        }
        analyzer.debug();
    };
    ScriptAnalyzer.prototype.debug = function () {
        console.log(this.spendingConditions.map(function (s) { return Util.exprToString(s); }).join(' && '));
        console.log('stack', this.stack);
        console.log('altstack', this.altstack);
    };
    ScriptAnalyzer.prototype.analyze = function () {
        var _a, _b, _c, _d, _e, _f, _g;
        while (this.scriptOffset < this.script.length) {
            var op = this.script[this.scriptOffset++];
            if (op instanceof Uint8Array) {
                this.stack.push(op);
            }
            else {
                switch (op) {
                    case opcodes.OP_0: {
                        this.stack.push(new Uint8Array([]));
                        break;
                    }
                    case opcodes.OP_1:
                    case opcodes.OP_2:
                    case opcodes.OP_3:
                    case opcodes.OP_4:
                    case opcodes.OP_5:
                    case opcodes.OP_6:
                    case opcodes.OP_7:
                    case opcodes.OP_8:
                    case opcodes.OP_9:
                    case opcodes.OP_10:
                    case opcodes.OP_11:
                    case opcodes.OP_12:
                    case opcodes.OP_13:
                    case opcodes.OP_14:
                    case opcodes.OP_15:
                    case opcodes.OP_16: {
                        this.stack.push(new Uint8Array([op - 0x50]));
                        break;
                    }
                    case opcodes.OP_NOP: {
                        break;
                    }
                    case opcodes.OP_IF: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    case opcodes.OP_NOTIF: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    case opcodes.OP_ELSE: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    case opcodes.OP_ENDIF: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    case opcodes.OP_VERIFY: {
                        if (!this.verify()) {
                            return ScriptError.SCRIPT_ERR_VERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_RETURN: {
                        return ScriptError.SCRIPT_ERR_OP_RETURN;
                    }
                    case opcodes.OP_TOALTSTACK: {
                        this.altstack.push(this.takeElements(1)[0]);
                        break;
                    }
                    case opcodes.OP_FROMALTSTACK: {
                        if (!this.altstack.length) {
                            return ScriptError.SCRIPT_ERR_INVALID_ALTSTACK_OPERATION;
                        }
                        this.stack.push(this.altstack.pop());
                        break;
                    }
                    case opcodes.OP_2DROP: {
                        this.takeElements(2);
                        break;
                    }
                    case opcodes.OP_2DUP: {
                        (_a = this.stack).push.apply(_a, this.readElements(2));
                        break;
                    }
                    case opcodes.OP_3DUP: {
                        (_b = this.stack).push.apply(_b, this.readElements(3));
                        break;
                    }
                    case opcodes.OP_2OVER: {
                        (_c = this.stack).push.apply(_c, this.readElements(4).slice(0, 2));
                        break;
                    }
                    case opcodes.OP_2ROT: {
                        var elems = this.takeElements(6);
                        (_d = this.stack).push.apply(_d, __spreadArray(__spreadArray([], elems.slice(2), false), elems.slice(0, 2), false));
                        break;
                    }
                    case opcodes.OP_2SWAP: {
                        var elems = this.takeElements(4);
                        (_e = this.stack).push.apply(_e, __spreadArray(__spreadArray([], elems.slice(2), false), elems.slice(0, 2), false));
                        break;
                    }
                    case opcodes.OP_IFDUP: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    case opcodes.OP_DEPTH: {
                        this.stack.push(ScriptConv.Int.encode(this.stack.length));
                        break;
                    }
                    case opcodes.OP_DROP: {
                        this.takeElements(1);
                        break;
                    }
                    case opcodes.OP_DUP: {
                        this.stack.push(this.readElements(1)[0]);
                        break;
                    }
                    case opcodes.OP_NIP: {
                        this.stack.push(this.takeElements(2)[1]);
                        break;
                    }
                    case opcodes.OP_OVER: {
                        this.stack.push(this.readElements(2)[0]);
                        break;
                    }
                    case opcodes.OP_PICK:
                    case opcodes.OP_ROLL: {
                        var top_1 = this.takeElements(1)[0];
                        if (!(top_1 instanceof Uint8Array)) {
                            throw "".concat(getOpcode(op), " can't use stack/output values as depth (yet)");
                        }
                        if (top_1.length > 4) {
                            return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
                        }
                        var index = ScriptConv.Int.decode(top_1);
                        if (index < 0) {
                            return ScriptError.SCRIPT_ERR_INVALID_STACK_OPERATION;
                        }
                        var elem = this.readElements(index + 1)[0];
                        if (op === opcodes.OP_ROLL) {
                            this.stack.splice(this.stack.length - index - 1, 1);
                        }
                        this.stack.push(elem);
                        break;
                    }
                    case opcodes.OP_ROT: {
                        var elems = this.takeElements(3);
                        (_f = this.stack).push.apply(_f, __spreadArray(__spreadArray([], elems.slice(1), false), [elems[0]], false));
                        break;
                    }
                    case opcodes.OP_SWAP: {
                        var elems = this.takeElements(2);
                        this.stack.push(elems[1], elems[0]);
                        break;
                    }
                    case opcodes.OP_TUCK: {
                        var elems = this.takeElements(2);
                        (_g = this.stack).push.apply(_g, __spreadArray([elems[1]], elems, false));
                        break;
                    }
                    case opcodes.OP_SIZE: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    case opcodes.OP_EQUAL:
                    case opcodes.OP_EQUALVERIFY: {
                        this.stack.push({ opcode: opcodes.OP_EQUAL, args: this.takeElements(2) });
                        if (op === opcodes.OP_EQUALVERIFY && !this.verify()) {
                            return ScriptError.SCRIPT_ERR_EQUALVERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_1ADD:
                    case opcodes.OP_1SUB:
                    case opcodes.OP_NEGATE:
                    case opcodes.OP_ABS:
                    case opcodes.OP_NOT:
                    case opcodes.OP_0NOTEQUAL: {
                        this.stack.push({ opcode: op, args: this.takeElements(1) });
                        break;
                    }
                    case opcodes.OP_ADD:
                    case opcodes.OP_SUB:
                    case opcodes.OP_BOOLAND:
                    case opcodes.OP_BOOLOR:
                    case opcodes.OP_NUMEQUAL:
                    case opcodes.OP_NUMEQUALVERIFY:
                    case opcodes.OP_NUMNOTEQUAL:
                    case opcodes.OP_LESSTHAN:
                    case opcodes.OP_GREATERTHAN:
                    case opcodes.OP_LESSTHANOREQUAL:
                    case opcodes.OP_GREATERTHANOREQUAL:
                    case opcodes.OP_MIN:
                    case opcodes.OP_MAX: {
                        this.stack.push({
                            opcode: op === opcodes.OP_NUMEQUALVERIFY ? opcodes.OP_NUMEQUAL : op,
                            args: this.takeElements(2)
                        });
                        if (op === opcodes.OP_EQUALVERIFY && !this.verify()) {
                            return ScriptError.SCRIPT_ERR_NUMEQUALVERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_WITHIN: {
                        this.stack.push({ opcode: op, args: this.takeElements(3) });
                        break;
                    }
                    case opcodes.OP_RIPEMD160:
                    case opcodes.OP_SHA1:
                    case opcodes.OP_SHA256:
                    case opcodes.OP_HASH160:
                    case opcodes.OP_HASH256: {
                        this.stack.push({ opcode: op, args: this.takeElements(1) });
                        break;
                    }
                    case opcodes.OP_CODESEPARATOR: {
                        break;
                    }
                    case opcodes.OP_CHECKSIG:
                    case opcodes.OP_CHECKSIGVERIFY: {
                        this.stack.push({ opcode: opcodes.OP_CHECKSIG, args: this.takeElements(2) });
                        if (op === opcodes.OP_CHECKSIGVERIFY && !this.verify()) {
                            return ScriptError.SCRIPT_ERR_CHECKSIGVERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_CHECKMULTISIG: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    case opcodes.OP_CHECKMULTISIGVERIFY: {
                        break;
                    }
                    case opcodes.OP_NOP1: {
                        break;
                    }
                    case opcodes.OP_CHECKLOCKTIMEVERIFY:
                    case opcodes.OP_CHECKSEQUENCEVERIFY: {
                        this.spendingConditions.push({ opcode: op, args: this.readElements(1) });
                        break;
                    }
                    case opcodes.OP_NOP4:
                    case opcodes.OP_NOP5:
                    case opcodes.OP_NOP6:
                    case opcodes.OP_NOP7:
                    case opcodes.OP_NOP8:
                    case opcodes.OP_NOP9:
                    case opcodes.OP_NOP10: {
                        break;
                    }
                    case opcodes.OP_CHECKSIGADD: {
                        throw "".concat(getOpcode(op), " not implemented (yet)");
                    }
                    default: {
                        return ScriptError.SCRIPT_ERR_BAD_OPCODE;
                    }
                }
            }
            if (this.stack.length + this.altstack.length > 1000) {
                return ScriptError.SCRIPT_ERR_STACK_SIZE;
            }
        }
        if (this.stack.length > 1) {
            return ScriptError.SCRIPT_ERR_CLEANSTACK;
        }
        if (!this.verify()) {
            return ScriptError.SCRIPT_ERR_EVAL_FALSE;
        }
    };
    /** OP_VERIFY */
    ScriptAnalyzer.prototype.verify = function () {
        var elem = this.takeElements(1)[0];
        if (elem instanceof Uint8Array) {
            if (!ScriptConv.Bool.decode(elem)) {
                return false;
            }
        }
        else {
            this.spendingConditions.push(elem);
        }
        return true;
    };
    ScriptAnalyzer.prototype.takeElements = function (amount) {
        var res = [];
        for (var i = 0; i < amount; i++) {
            if (this.stack.length) {
                res.push(this.stack.pop());
            }
            else {
                res.push({ "var": this.varCounter++ });
            }
        }
        return res;
    };
    ScriptAnalyzer.prototype.readElements = function (amount) {
        while (this.stack.length < amount) {
            this.stack.unshift({ "var": this.varCounter++ });
        }
        return this.stack.slice(this.stack.length - amount);
    };
    return ScriptAnalyzer;
}());
var opcodes = {
    // https://github.com/bitcoin/bitcoin/blob/fa5c896724bb359b4b9a3f89580272bfe5980c1b/src/script/script.h#L65-L206
    // push value
    OP_0: 0x00,
    OP_FALSE: 0x00,
    OP_PUSHDATA1: 0x4c,
    OP_PUSHDATA2: 0x4d,
    OP_PUSHDATA4: 0x4e,
    OP_1NEGATE: 0x4f,
    OP_RESERVED: 0x50,
    OP_1: 0x51,
    OP_TRUE: 0x51,
    OP_2: 0x52,
    OP_3: 0x53,
    OP_4: 0x54,
    OP_5: 0x55,
    OP_6: 0x56,
    OP_7: 0x57,
    OP_8: 0x58,
    OP_9: 0x59,
    OP_10: 0x5a,
    OP_11: 0x5b,
    OP_12: 0x5c,
    OP_13: 0x5d,
    OP_14: 0x5e,
    OP_15: 0x5f,
    OP_16: 0x60,
    // control
    OP_NOP: 0x61,
    OP_VER: 0x62,
    OP_IF: 0x63,
    OP_NOTIF: 0x64,
    OP_VERIF: 0x65,
    OP_VERNOTIF: 0x66,
    OP_ELSE: 0x67,
    OP_ENDIF: 0x68,
    OP_VERIFY: 0x69,
    OP_RETURN: 0x6a,
    // stack ops
    OP_TOALTSTACK: 0x6b,
    OP_FROMALTSTACK: 0x6c,
    OP_2DROP: 0x6d,
    OP_2DUP: 0x6e,
    OP_3DUP: 0x6f,
    OP_2OVER: 0x70,
    OP_2ROT: 0x71,
    OP_2SWAP: 0x72,
    OP_IFDUP: 0x73,
    OP_DEPTH: 0x74,
    OP_DROP: 0x75,
    OP_DUP: 0x76,
    OP_NIP: 0x77,
    OP_OVER: 0x78,
    OP_PICK: 0x79,
    OP_ROLL: 0x7a,
    OP_ROT: 0x7b,
    OP_SWAP: 0x7c,
    OP_TUCK: 0x7d,
    // splice ops
    OP_CAT: 0x7e,
    OP_SUBSTR: 0x7f,
    OP_LEFT: 0x80,
    OP_RIGHT: 0x81,
    OP_SIZE: 0x82,
    // bit logic
    OP_INVERT: 0x83,
    OP_AND: 0x84,
    OP_OR: 0x85,
    OP_XOR: 0x86,
    OP_EQUAL: 0x87,
    OP_EQUALVERIFY: 0x88,
    OP_RESERVED1: 0x89,
    OP_RESERVED2: 0x8a,
    // numeric
    OP_1ADD: 0x8b,
    OP_1SUB: 0x8c,
    OP_2MUL: 0x8d,
    OP_2DIV: 0x8e,
    OP_NEGATE: 0x8f,
    OP_ABS: 0x90,
    OP_NOT: 0x91,
    OP_0NOTEQUAL: 0x92,
    OP_ADD: 0x93,
    OP_SUB: 0x94,
    OP_MUL: 0x95,
    OP_DIV: 0x96,
    OP_MOD: 0x97,
    OP_LSHIFT: 0x98,
    OP_RSHIFT: 0x99,
    OP_BOOLAND: 0x9a,
    OP_BOOLOR: 0x9b,
    OP_NUMEQUAL: 0x9c,
    OP_NUMEQUALVERIFY: 0x9d,
    OP_NUMNOTEQUAL: 0x9e,
    OP_LESSTHAN: 0x9f,
    OP_GREATERTHAN: 0xa0,
    OP_LESSTHANOREQUAL: 0xa1,
    OP_GREATERTHANOREQUAL: 0xa2,
    OP_MIN: 0xa3,
    OP_MAX: 0xa4,
    OP_WITHIN: 0xa5,
    // crypto
    OP_RIPEMD160: 0xa6,
    OP_SHA1: 0xa7,
    OP_SHA256: 0xa8,
    OP_HASH160: 0xa9,
    OP_HASH256: 0xaa,
    OP_CODESEPARATOR: 0xab,
    OP_CHECKSIG: 0xac,
    OP_CHECKSIGVERIFY: 0xad,
    OP_CHECKMULTISIG: 0xae,
    OP_CHECKMULTISIGVERIFY: 0xaf,
    // expansion
    OP_NOP1: 0xb0,
    OP_CHECKLOCKTIMEVERIFY: 0xb1,
    OP_NOP2: 0xb1,
    OP_CHECKSEQUENCEVERIFY: 0xb2,
    OP_NOP3: 0xb2,
    OP_NOP4: 0xb3,
    OP_NOP5: 0xb4,
    OP_NOP6: 0xb5,
    OP_NOP7: 0xb6,
    OP_NOP8: 0xb7,
    OP_NOP9: 0xb8,
    OP_NOP10: 0xb9,
    // Opcode added by BIP 342 (Tapscript)
    OP_CHECKSIGADD: 0xba,
    OP_INVALIDOPCODE: 0xff,
    // aliases
    OP_CLTV: 0xb1,
    OP_CSV: 0xb2
};
/** Disabled because of CVE-2010-5137 */
var disabledOpcodes = [
    opcodes.OP_CAT,
    opcodes.OP_SUBSTR,
    opcodes.OP_LEFT,
    opcodes.OP_RIGHT,
    opcodes.OP_INVERT,
    opcodes.OP_AND,
    opcodes.OP_OR,
    opcodes.OP_XOR,
    opcodes.OP_2MUL,
    opcodes.OP_2DIV,
    opcodes.OP_MUL,
    opcodes.OP_DIV,
    opcodes.OP_MOD,
    opcodes.OP_LSHIFT,
    opcodes.OP_RSHIFT
];
function getOpcode(op) {
    var o = Object.entries(opcodes).find(function (x) { return x[1] === op; });
    if (o) {
        return o[0];
    }
}
// From the Bitcoin Core source code, files src/script/script_error.{h,cpp} at commit b1a2021f78099c17360dc2179cbcb948059b5969
// Edited for TypeScript use
// Orignal Bitcoin Core copyright header:
// Copyright (c) 2009-2010 Satoshi Nakamoto
// Copyright (c) 2009-2020 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.
var ScriptError;
(function (ScriptError) {
    ScriptError[ScriptError["SCRIPT_ERR_OK"] = 0] = "SCRIPT_ERR_OK";
    ScriptError[ScriptError["SCRIPT_ERR_UNKNOWN_ERROR"] = 1] = "SCRIPT_ERR_UNKNOWN_ERROR";
    ScriptError[ScriptError["SCRIPT_ERR_EVAL_FALSE"] = 2] = "SCRIPT_ERR_EVAL_FALSE";
    ScriptError[ScriptError["SCRIPT_ERR_OP_RETURN"] = 3] = "SCRIPT_ERR_OP_RETURN";
    /* Max sizes */
    ScriptError[ScriptError["SCRIPT_ERR_SCRIPT_SIZE"] = 4] = "SCRIPT_ERR_SCRIPT_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_PUSH_SIZE"] = 5] = "SCRIPT_ERR_PUSH_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_OP_COUNT"] = 6] = "SCRIPT_ERR_OP_COUNT";
    ScriptError[ScriptError["SCRIPT_ERR_STACK_SIZE"] = 7] = "SCRIPT_ERR_STACK_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_COUNT"] = 8] = "SCRIPT_ERR_SIG_COUNT";
    ScriptError[ScriptError["SCRIPT_ERR_PUBKEY_COUNT"] = 9] = "SCRIPT_ERR_PUBKEY_COUNT";
    /* Failed verify operations */
    ScriptError[ScriptError["SCRIPT_ERR_VERIFY"] = 10] = "SCRIPT_ERR_VERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_EQUALVERIFY"] = 11] = "SCRIPT_ERR_EQUALVERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_CHECKMULTISIGVERIFY"] = 12] = "SCRIPT_ERR_CHECKMULTISIGVERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_CHECKSIGVERIFY"] = 13] = "SCRIPT_ERR_CHECKSIGVERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_NUMEQUALVERIFY"] = 14] = "SCRIPT_ERR_NUMEQUALVERIFY";
    /* Logical/Format/Canonical errors */
    ScriptError[ScriptError["SCRIPT_ERR_BAD_OPCODE"] = 15] = "SCRIPT_ERR_BAD_OPCODE";
    ScriptError[ScriptError["SCRIPT_ERR_DISABLED_OPCODE"] = 16] = "SCRIPT_ERR_DISABLED_OPCODE";
    ScriptError[ScriptError["SCRIPT_ERR_INVALID_STACK_OPERATION"] = 17] = "SCRIPT_ERR_INVALID_STACK_OPERATION";
    ScriptError[ScriptError["SCRIPT_ERR_INVALID_ALTSTACK_OPERATION"] = 18] = "SCRIPT_ERR_INVALID_ALTSTACK_OPERATION";
    ScriptError[ScriptError["SCRIPT_ERR_UNBALANCED_CONDITIONAL"] = 19] = "SCRIPT_ERR_UNBALANCED_CONDITIONAL";
    /* CHECKLOCKTIMEVERIFY and CHECKSEQUENCEVERIFY */
    ScriptError[ScriptError["SCRIPT_ERR_NEGATIVE_LOCKTIME"] = 20] = "SCRIPT_ERR_NEGATIVE_LOCKTIME";
    ScriptError[ScriptError["SCRIPT_ERR_UNSATISFIED_LOCKTIME"] = 21] = "SCRIPT_ERR_UNSATISFIED_LOCKTIME";
    /* Malleability */
    ScriptError[ScriptError["SCRIPT_ERR_SIG_HASHTYPE"] = 22] = "SCRIPT_ERR_SIG_HASHTYPE";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_DER"] = 23] = "SCRIPT_ERR_SIG_DER";
    ScriptError[ScriptError["SCRIPT_ERR_MINIMALDATA"] = 24] = "SCRIPT_ERR_MINIMALDATA";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_PUSHONLY"] = 25] = "SCRIPT_ERR_SIG_PUSHONLY";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_HIGH_S"] = 26] = "SCRIPT_ERR_SIG_HIGH_S";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_NULLDUMMY"] = 27] = "SCRIPT_ERR_SIG_NULLDUMMY";
    ScriptError[ScriptError["SCRIPT_ERR_PUBKEYTYPE"] = 28] = "SCRIPT_ERR_PUBKEYTYPE";
    ScriptError[ScriptError["SCRIPT_ERR_CLEANSTACK"] = 29] = "SCRIPT_ERR_CLEANSTACK";
    ScriptError[ScriptError["SCRIPT_ERR_MINIMALIF"] = 30] = "SCRIPT_ERR_MINIMALIF";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_NULLFAIL"] = 31] = "SCRIPT_ERR_SIG_NULLFAIL";
    /* softfork safeness */
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS"] = 32] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM"] = 33] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION"] = 34] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_OP_SUCCESS"] = 35] = "SCRIPT_ERR_DISCOURAGE_OP_SUCCESS";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE"] = 36] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE";
    /* segregated witness */
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH"] = 37] = "SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY"] = 38] = "SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH"] = 39] = "SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_MALLEATED"] = 40] = "SCRIPT_ERR_WITNESS_MALLEATED";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_MALLEATED_P2SH"] = 41] = "SCRIPT_ERR_WITNESS_MALLEATED_P2SH";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_UNEXPECTED"] = 42] = "SCRIPT_ERR_WITNESS_UNEXPECTED";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PUBKEYTYPE"] = 43] = "SCRIPT_ERR_WITNESS_PUBKEYTYPE";
    /* Taproot */
    ScriptError[ScriptError["SCRIPT_ERR_SCHNORR_SIG_SIZE"] = 44] = "SCRIPT_ERR_SCHNORR_SIG_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_SCHNORR_SIG_HASHTYPE"] = 45] = "SCRIPT_ERR_SCHNORR_SIG_HASHTYPE";
    ScriptError[ScriptError["SCRIPT_ERR_SCHNORR_SIG"] = 46] = "SCRIPT_ERR_SCHNORR_SIG";
    ScriptError[ScriptError["SCRIPT_ERR_TAPROOT_WRONG_CONTROL_SIZE"] = 47] = "SCRIPT_ERR_TAPROOT_WRONG_CONTROL_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_TAPSCRIPT_VALIDATION_WEIGHT"] = 48] = "SCRIPT_ERR_TAPSCRIPT_VALIDATION_WEIGHT";
    ScriptError[ScriptError["SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG"] = 49] = "SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG";
    ScriptError[ScriptError["SCRIPT_ERR_TAPSCRIPT_MINIMALIF"] = 50] = "SCRIPT_ERR_TAPSCRIPT_MINIMALIF";
    /* Constant scriptCode */
    ScriptError[ScriptError["SCRIPT_ERR_OP_CODESEPARATOR"] = 51] = "SCRIPT_ERR_OP_CODESEPARATOR";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_FINDANDDELETE"] = 52] = "SCRIPT_ERR_SIG_FINDANDDELETE";
    ScriptError[ScriptError["SCRIPT_ERR_ERROR_COUNT"] = 53] = "SCRIPT_ERR_ERROR_COUNT";
    ScriptError[ScriptError["SCRIPT_ERR_LAST"] = 53] = "SCRIPT_ERR_LAST";
    // bitcoin core returns unknown error for this one so added it myself
    ScriptError[ScriptError["SCRIPT_ERR_NUM_OVERFLOW"] = 54] = "SCRIPT_ERR_NUM_OVERFLOW";
    //
})(ScriptError || (ScriptError = {}));
function scriptErrorString(serror) {
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
var ScriptConv;
(function (ScriptConv) {
    var Int;
    (function (Int) {
        function encode(n) {
            var buf = [];
            var neg = n < 0;
            var abs = Math.abs(n);
            while (abs) {
                buf.push(abs & 0xff);
                abs >>= 8;
            }
            if (buf[buf.length - 1] & 0x80) {
                buf.push(neg ? 0x80 : 0x00);
            }
            else if (neg) {
                buf[buf.length - 1] |= 0x80;
            }
            return new Uint8Array(buf);
        }
        Int.encode = encode;
        function encodeHex(n) {
            return Util.bufferToHex(encode(n));
        }
        Int.encodeHex = encodeHex;
        function decode(buf) {
            if (!buf.length) {
                return 0;
            }
            var neg = buf[buf.length - 1] & 0x80;
            if (neg) {
                // clone before editing
                buf = buf.slice();
                buf[buf.length - 1] &= 0x7f;
            }
            var n = 0;
            for (var i = 0; i != buf.length; ++i) {
                n |= buf[i] << (i * 8);
            }
            return neg ? -n : n;
        }
        Int.decode = decode;
    })(Int = ScriptConv.Int || (ScriptConv.Int = {}));
    var Bool;
    (function (Bool) {
        function encode(b) {
            return new Uint8Array(b ? [1] : []);
        }
        Bool.encode = encode;
        function decode(buf) {
            for (var i = 0; i < buf.length; i++) {
                if (buf[i] !== 0) {
                    return i !== buf.length - 1 || buf[i] !== 0x80;
                }
            }
            return false;
        }
        Bool.decode = decode;
    })(Bool = ScriptConv.Bool || (ScriptConv.Bool = {}));
})(ScriptConv || (ScriptConv = {}));
var Util;
(function (Util) {
    function scriptElemToHex(buf) {
        return '<' + bufferToHex(buf) + '>';
    }
    Util.scriptElemToHex = scriptElemToHex;
    function bufferToHex(buf) {
        var hex = '';
        for (var i = 0; i < buf.length; i++) {
            hex += buf[i].toString(16).padStart(2, '0');
        }
        return hex;
    }
    Util.bufferToHex = bufferToHex;
    function hexToBuffer(hex) {
        var _a;
        return new Uint8Array((_a = hex.match(/../g)) === null || _a === void 0 ? void 0 : _a.map(function (x) { return parseInt(x, 16); }));
    }
    Util.hexToBuffer = hexToBuffer;
    function intEncodeLEHex(n, len) {
        return n
            .toString(16)
            .padStart(len * 2, '0')
            .match(/../g)
            .reverse()
            .join('');
    }
    Util.intEncodeLEHex = intEncodeLEHex;
    function intDecodeLE(buf) {
        return parseInt(bufferToHex(buf.slice().reverse()), 16);
    }
    Util.intDecodeLE = intDecodeLE;
    function exprToString(e) {
        if ('opcode' in e) {
            return "".concat((getOpcode(e.opcode) || 'UNKNOWN').replace(/^OP_/, ''), "(").concat(e.args.map(function (a) {
                return a instanceof Uint8Array ? scriptElemToHex(a) : exprToString(a);
            }), ")");
        }
        else {
            return "<input".concat(e["var"], ">");
        }
    }
    Util.exprToString = exprToString;
    /** Returns true if at least 1 element of the first list is present in the second list */
    function overlap(list1, list2) {
        for (var _i = 0, list1_1 = list1; _i < list1_1.length; _i++) {
            var e = list1_1[_i];
            if (list2.includes(e)) {
                return true;
            }
        }
        return false;
    }
    Util.overlap = overlap;
})(Util || (Util = {}));
