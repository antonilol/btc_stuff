const id = e => document.getElementById(e);

function getopcode(hex) {
	const o = Object.entries(opcodes).find(x => x[1] == hex);
	if (o) {
		return o[0];
	}
	return;
}

function tohex(n, l=1) {
	return ('00'.repeat(l) + (((n < 0 ? 1 << (l * 8 - 1) : 0) | Math.abs(n)) >>> 0).toString(16)).slice(-l * 2).match(/../g).reverse().join('');
}

function toint(h, l=1) {
	const n = parseInt(h.reverse().join(''), 16);
	const a = n & (0x7fffffff >> ((4 - l) * 8));
	if (n & (1 << (l * 8 - 1))) {
		return -a;
	}
	return a;
}

[ 'asm', 'hex' ].forEach(el => id(el).addEventListener('keydown', function(e) {
	if (e.key == 'Tab') {
		e.preventDefault();
		const start = this.selectionStart;
		const end = this.selectionEnd;
		const val = this.value;

		this.value = val.substring(0, start) + '\t' + val.substring(end);

		this.selectionStart = start + 1;
		this.selectionEnd = start + 1;
	}
}));

[ 'keydown', 'keypress', 'keyup' ].forEach(a => {
	id('asm').addEventListener(a, e => {
		id('asm-error').innerText = asmtohex() || '';
	});
	id('hex').addEventListener(a, e => {
		id('hex-error').innerText = hextoasm() || '';
	});
});

function asmtohex() {
	const src = id('asm').value.split(/[ \t\n]+/);
	if (!src.length || src.length == 1 && !src[0]) {
		id('hex').value = '';
		return;
	}
	var script = '';
	for (const op of src) {
		if (/^(|-)[0-9]+$/.test(op)) {
			const n = parseInt(op);
			if (n == 0) {
				// OP_0
				script += '00';
			} else if (n >= -1 && n <= 16) {
				// OP_1NEGATE (4f), OP_1 (51) ... OP_16 (60)
				script += tohex(0x50 + n);
			} else {
				const a = Math.abs(n);
				var push = 1;
				if (a > 0x7fffffff) {
					return 'Too large decimal integer';
				} else if (a > 0x7fffff) {
					push = 4;
				} else if (a > 0x7fff) {
					push = 3;
				} else if (a > 0x7f) {
					push = 2;
				}
				script += tohex(push) + tohex(n, push);
			}
		} else if (/^<[0-9a-fA-F]*>$/.test(op)) {
			var hex = op.slice(1, -1).toLowerCase();
			if (hex.length & 1) {
				return 'Odd amount of characters in hex literal'
			}
			const n = parseInt(hex, 16);
			if (n <= 16) {
				// OP_0 ... OP_16
				script += tohex(opcodes['OP_' + n]);
			} else {
				const l = hex.length / 2;
				if (l <= 75) {
					script += tohex(l);
				} else if (l <= 0xff) {
					// OP_PUSHDATA1
					script += '4c' + tohex(l);
				} else if (l <= 520) {
					// OP_PUSHDATA2
					script += '4d' + tohex(l, 2);
				} else {
					return 'Data push too large';
				}
				script += hex;
			}
		} else {
			var opcode = opcodes[op.toUpperCase()];
			if (opcode === undefined) {
				opcode = opcodes['OP_' + op.toUpperCase()];
			}
			if (opcode === undefined) {
				return 'Unknown opcode ' + op + (/^[0-9a-fA-F]+$/.test(op) ? '. If you tried to push hex data, encapsulate it with < and >' : '');
			}
			if (/PUSHDATA(1|2|4)$/.test(op.toUpperCase())) {
				return 'OP_PUSHDATA is not allowed is Bitcoin ASM script'
			}
			script += tohex(opcode);
		}
	}
	id('hex').value = script;
	id('hex-error').innerText = '';
}

function hextoasm() {
	const v = id('hex').value.replace(/[ \t\n]+/g,'').toLowerCase();
	if (!v) {
		id('asm').value = '';
		return;
	}
	if (!/^[0-9a-f]+$/.test(v)) {
		return 'Illegal characters in hex literal';
	}
	if (v.length % 2) {
		return 'Odd amount of characters in hex literal';
	}
	const bytes = v.match(/../g);
	const script = [];
	while (bytes && bytes.length) {
		const h = bytes.shift();
		const b = parseInt(h, 16);
		const op = getopcode(b);
		if (op) {
			if (op.startsWith('OP_PUSHDATA')) {
				const n = parseInt(op.match(/1|2|4/)[0]);
				const l = toint(bytes.splice(0, n));
				if (l > 520) {
					return 'Data push too large';
				}
				const data = bytes.splice(0, l);
				if (data.length != l) {
					return 'Invalid length, expected ' + l + ' but got ' + data.length;
				}
				script.push('<' + data.join('') + '>');
			} else {
				if (b == 0) {
					script.push(0);
				} else if (b >= opcodes.OP_1NEGATE && b <= opcodes.OP_16) {
					script.push(b - 0x50);
				} else {
					script.push(op);
				}
			}
		} else if (b <= 75) {
			const data = bytes.splice(0, b);
			if (data.length != b) {
				return 'Invalid length, expected ' + b + ' but got ' + data.length;
			}
			if (b <= 4) {
				script.push(toint(data, b));
			} else {
				script.push('<' + data.join('') + '>');
			}
		} else {
			return 'Invalid opcode 0x' + h;
		}
	}
	id('asm').value = script.join(' ');
	id('asm-error').innerText = '';
}
