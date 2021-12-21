const id = e => document.getElementById(e);
const cs = e => [...document.getElementsByClassName(e)];

id('key').addEventListener('change', () => {
	const o = id('key').selectedOptions.item(0);
	if (o) {
		const cl = o.classList;

		if (cl.contains('bool')) {
			id('bool').style.display = '';
			id('val').style.display = 'none';
		} else {
			id('bool').style.display = 'none';
			id('val').style.display = '';
		}

		if (cl.contains('num')) {
			cs('numcomp').forEach(e => e.style.display = '');
		} else {
			cs('numcomp').forEach(e => e.style.display = 'none');
			if (id('comp').selectedIndex > 1) {
				id('comp').selectedIndex = 0;
			}
		}

		if (o.value == 'amount') {
			id('unit').style.display = '';
			unitchange();
		} else {
			id('unit').style.display = 'none';
		}
	}
});

id('unit').addEventListener('change', unitchange);

var fprev = getAmountFactor();

function getAmountFactor() {
	const u = id('unit').selectedOptions.item(0);
	if (u) {
		var f = 0;
		if (u.value == 'BTC') {
			f = 8;
		} else if (u.value == 'mBTC') {
			f = 5
		} else if (u.value == 'sat') {
			f = 0;
		}
		return f;
	}
}

function unitchange() {
	const f = getAmountFactor();
	if (f !== undefined) {
		const v = parseFloat(parseFloat(id('val').value).toFixed(fprev));

		if (v && !isNaN(v)) {
			id('val').value = (v * (10 ** (fprev - f))).toFixed(f);
		}

		fprev = f;
	}
}

const rules = [];

id('ok').addEventListener('click', () => {
	const r = [ 'use', 'key', 'comp' ].map(x => {
		const e = id(x).selectedOptions.item(0);
		return [ e.innerText, e.value ];
	});
	rules.push(r);
	const cl = id('key').selectedOptions.item(0).classList;
	if (cl.contains('num')) {
		var n = parseFloat(id('val').value);
		console.log(r[1][1]);
		if (r[1][1] == 'amount') {
			n *= 10 ** (fprev - 8);
			n = parseFloat(n.toFixed(8));
		}
		r.push([ n ]);
	} else if (cl.contains('bool')) {
		r.push([ id('val').value == 'true' ]);
	} else {
		r.push([ id('val').value ]);
	}
	displayRules();
});

function displayRules() {
	const e = id('rules');
	e.innerHTML = '';
	rules.forEach((x, i) => {
		if (i) {
			e.appendChild(document.createElement('br'));
		}
		const rm = document.createElement('button');
		rm.addEventListener('click', () => {
			rules.splice(i, 1);
			displayRules();
		});
		rm.innerHTML = '&times;';
		e.appendChild(rm);
		e.appendChild(document.createTextNode(
			`${x[0][0]} UTXOs with ${x.map(x => x[0]).slice(1).join(' ')}${x[1][0] == 'amount' ? ' BTC' : ''}`
		));
	});
}
