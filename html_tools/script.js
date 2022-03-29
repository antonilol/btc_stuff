const id = e => document.getElementById(e);

function getopcode(hex) {
	const o = Object.entries(opcodes).find(x => x[1] == hex);
	if (o) {
		return o[0];
	}
	return;
}

function tohex(data, length) {
	if (typeof data == 'string') {
		return data.split('').map(x => ('0' + (x.charCodeAt(0) & 0xff).toString(16)).slice(-2)).join('');
	}
	if (typeof data == 'number') {
		const l = length || 1;
		return ('00'.repeat(l) + data.toString(16)).slice(-l * 2).match(/../g).reverse().join('');
	}
}

function parseIntLE(hex) {
	if (typeof hex === 'string') {
		hex = hex.match(/../g);
	}
	return parseInt(hex.reverse().join(''), 16);
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
	id('asm').addEventListener(a, asmtohex);
	id('hex').addEventListener(a, hextoasm);
});

function asmtohex() {
	const src = id('asm').value.split(/[ \t\n]+/);
	var script = '';
	for (const op of src) {
		if (!op.length) {
			continue;
		}
		if (op.toLowerCase().startsWith('op_')) {
			const opcode = opcodes[op.toUpperCase()];
			if (opcode === undefined) {
				id('asm-error').innerText = 'Unknown opcode ' + op;
				return;
			}
			script += tohex(opcode);
		} else if (/^(0x|)[0-9a-fA-F]+$/.test(op)) {
			// TODO decimal/hexadecimal
			// https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki#numbers
			const n = parseInt(op, 16);
			if (n <= 0x10) {
				script += tohex(opcodes['OP_' + n]);
			} else {
				const h = (op.length % 2 ? '0' : '') + op.toLowerCase();
				const l = h.length / 2;
				if (l <= 75) {
					script += tohex(l);
				} else if (l <= 0xff) {
					script += '4c' + tohex(l);
				} else if (l <= 0xffff) {
					script += '4d' + tohex(l, 2);
				} else if (l <= 0xffffffff) {
					script += '4e' + tohex(l, 4);
				} else {
					id('asm-error').innerText = 'Bytes too long';
					return;
				}
				script += h;
			}
		} else {
			id('asm-error').innerText = 'Unknown opcode ' + op;
			return;
		}
	}
	id('hex').value = script;
	id('asm-error').innerText = '';
}

function hextoasm() {
	const v = id('hex').value.replace(/[ \t\n]+/g,'');
	if (!v) {
		id('asm').value = '';
		id('hex-error').innerText = '';
		return;
	}
	if (!v.match(/^[0-9a-f]+$/)) {
		id('hex-error').innerText = 'Non hex characters are not allowed';
		return;
	}
	if (v.length % 2) {
		id('hex-error').innerText = 'Odd amount of characters';
		return;
	}
	const bytes = v.match(/../g);
	const script = [];
	if (bytes) {
		while (bytes.length) {
			const h = bytes.shift();
			const b = parseInt(h, 16);
			const op = getopcode(b);
			if (op) {
				if (op.startsWith('OP_PUSHDATA')) {
					const n = parseInt(op.match(/[0-9]+/)[0]);
					const l = parseIntLE(bytes.splice(0, n));
					const data = bytes.splice(0, l);
					if (data.length != l) {
						id('hex-error').innerText = 'Invalid length, expected ' + l + ' but got ' + data.length;
						return;
					}
					script.push(data.join(''));
				} else {
					script.push(op);
				}
			} else if (b <= 75) {
				const data = bytes.splice(0, b);
				if (data.length != b) {
					id('hex-error').innerText = 'Invalid length, expected ' + b + ' but got ' + data.length;
					return;
				}
				script.push(data.join(''));
			} else {
				id('hex-error').innerText = 'Invalid opcode 0x' + h;
				return;
			}
		}
	}
	id('asm').value = script.join(' ');
	id('hex-error').innerText = '';
}
