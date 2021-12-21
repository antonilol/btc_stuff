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

const modules = {
	ripemd160: {
		lines: `const ripemd160 = require('ripemd160');\n`,
		module: 'ripemd160',
		version: '^0.9.0'
	},
	sha256: {
		lines: `const sha256 = require('js-sha256');\n`,
		module: 'js-sha256',
		version: '^2.0.2'
	},
	sha1: {
		lines: `const sha1 = require('sha1');\n`,
		module: 'sha1',
		version: '^1.1.1'
	}
}

const fxs = {
	popn: {
		lines: `
function popn() {
	const a = stack.pop();
	if (typeof a === 'object') {
		if (a.length > 4) {
			process.exit(1);
		}
		return parseInt(a.reverse().toString('hex'), 16);
	}
	return a;
}
`},
	popb: {
		lines: `
function popb() {
	const a = stack.pop();
	if (typeof a === 'object') {
		return a.some(x => x);
	}
	return a;
}
`}
}

var indent = 0;
const used = {};
const tab = '\t';
const i   = s => tab.repeat(s || indent);
const use = x => used[x] = 1;

function opcodejs(op) {
	const n = op.match(/^OP_([0-9])+$/);
	if (n) {
		return `stack.push(${n[1]});\n`;
	}
	if (op == 'OP_EQUALVERIFY') {
		return opcodejs('OP_EQUAL') + i() +  opcodejs('OP_VERIFY');
	} else if (op == 'OP_NUMEQUALVERIFY') {
		return opcodejs('OP_NUMEQUAL') + i() +  opcodejs('OP_VERIFY');
	} else if (op == 'OP_CHECKSIGVERIFY') {
		return opcodejs('OP_CHECKSIG') + i() +  opcodejs('OP_VERIFY');
	} else if (op == 'OP_CHECKMULTISIGVERIFY') {
		return opcodejs('OP_CHECKMULTISIG') + i() +  opcodejs('OP_VERIFY');
	} else if (op == 'OP_NOTIF') {
		return opcodejs('OP_NOT') + i() + opcodejs('OP_IF');
	} else if (op == 'OP_HASH160') {
		return opcodejs('OP_SHA256') + i() + opcodejs('OP_RIPEMD160');
	} else if (op == 'OP_HASH256') {
		return opcodejs('OP_SHA256') + i() + opcodejs('OP_SHA256');
	}

	if (op == 'OP_EQUAL') {
		return `stack.push(stack.pop() == stack.pop());\n`;
	} else if (op == 'OP_VERIFY') {
		use('popb');
		return `if (!popb()) {	process.exit(1);}\n`;
	} else if (op == 'OP_ADD') {
		use('popn');
		return `stack.push(popn() + popn());\n`;
	}

	return `// TODO: ${op}\n`;
}

function asmtojs(check=true) {
	const src = id('asm').value.split(/[ \t\n]+/);
	var script = '';
	for (var op of src) {
		if (!op.length) {
			continue;
		}
		if (op.toLowerCase().startsWith('op_')) {
			const opcode = opcodes[op.toUpperCase()];
			if (check && opcode === undefined) {
				id('asme').innerText = 'Unknown opcode ' + op;
				return;
			}
			script += i() +  opcodejs(getopcode(opcode));
		} else if (/^(0x|)[0-9a-fA-F]+$/.test(op)) {
			script += `push(Buffer.from('${op}', 'hex'));\n`
		} else if (check) {
			id('asme').innerText = 'Unknown opcode ' + op;
			return;
		}
	}
	Object.keys(fxs).forEach(k => {
		if (used[k]) {
			script = fxs[k].lines + script;
		}
	});
	script = `const stack = [];\n` + script;
	Object.keys(modules).forEach(k => {
		if (used[k]) {
			script = modules[k].lines + script;
		}
	});
	id('js').value = script;
	if (check) {
		id('asme').innerText = '';
	}
}

function asmtohex() {
	const src = id('asm').value.split(/[ \t\n]+/);
	var script = '';
	for (var op of src) {
		if (!op.length) {
			continue;
		}
		if (op.toLowerCase().startsWith('op_')) {
			const opcode = opcodes[op.toUpperCase()];
			if (opcode === undefined) {
				id('asme').innerText = 'Unknown opcode ' + op;
				return;
			}
			script += tohex(opcode);
		} else if (/^(0x|)[0-9a-fA-F]+$/.test(op)) {
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
					id('asme').innerText = 'Bytes too long';
					return;
				}
				script += h;
			}
		} else {
			id('asme').innerText = 'Unknown opcode ' + op;
			return;
		}
	}
	id('hex').value = script;
	id('asme').innerText = '';

	asmtojs();
}

function hextoasm() {
	const v = id('hex').value.replace(/[ \t\n]+/g,'');
	if (!v) {
		return;
	}
	if (!v.match(/^[0-9a-f]+$/)) {
		id('hexe').innerText = 'Non hex characters are not allowed';
		return;
	}
	if (v.length % 2) {
		id('hexe').innerText = 'Odd amount of characters';
		return;
	}
	const bytes = v.match(/../g);
	var script = [];
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
						id('hexe').innerText = 'Invalid length, expected ' + l + ' but got ' + data.length;
						return;
					}
					script.push(data.join(''));
				} else {
					script.push(op);
				}
			} else if (b <= 75) {
				const data = bytes.splice(0, b);
				if (data.length != b) {
					id('hexe').innerText = 'Invalid length, expected ' + b + ' but got ' + data.length;
					return;
				}
				script.push(data.join(''));
			} else {
				id('hexe').innerText = 'Invalid opcode 0x' + h;
				return;
			}
		}
	}
	id('asm').value = script.join(' ');
	id('hexe').innerText = '';

	asmtojs(false);
}
