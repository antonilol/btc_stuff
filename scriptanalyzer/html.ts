const html = {
	asm: document.getElementById('asm')!,
	asmError: document.getElementById('asm-error')!,
	hex: document.getElementById('hex')!,
	hexError: document.getElementById('hex-error')!,
	analysis: document.getElementById('analysis')!,
	scriptVersion: <HTMLSelectElement>document.getElementById('script-version')!,
	scriptRules: <HTMLSelectElement>document.getElementById('script-rules')!,
	webcryptoError: document.getElementById('webcrypto-error')!
};

html.webcryptoError.hidden = window.isSecureContext;

[ 'keydown', 'keypress', 'keyup' ].forEach(a => {
	html.asm.addEventListener(a, () => {
		try {
			const hex = (html.hex.innerHTML = asmtohex(html.asm.innerText));
			runAnalyzer(parseHexScript(hex));
			html.asmError.innerText = '';
		} catch (e) {
			if (typeof e === 'string') {
				html.asmError.innerText = e;
			} else {
				throw e;
			}
		}
	});
	html.hex.addEventListener(a, () => {
		try {
			const script = parseHexScript(html.hex.innerText);
			html.asm.innerHTML = '';
			scriptToAsm(script).forEach(e => {
				const span = document.createElement('span');
				span.innerText = e.s;
				span.classList.add(`script-${OpcodeType[e.t].toLowerCase()}`);
				html.asm.appendChild(span);
				html.asm.appendChild(document.createElement('br'));
			});
			runAnalyzer(script);
			html.hexError.innerText = '';
		} catch (e) {
			if (typeof e === 'string') {
				html.hexError.innerText = e;
			} else {
				throw e;
			}
		}
	});
});

function runAnalyzer(script: Script) {
	try {
		ScriptAnalyzer.analyzeScript(script);
	} catch (e) {
		console.error('ScriptAnalyzer error', e);
	}
}

function getScriptVersion(): ScriptVersion {
	return html.scriptVersion.selectedIndex;
}

function getScriptRules(): ScriptRules {
	return html.scriptRules.selectedIndex;
}
