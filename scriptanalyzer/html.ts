const html = {
	asm: document.getElementById('asm')!,
	asmError: document.getElementById('asm-error')!,
	hex: document.getElementById('hex')!,
	hexError: document.getElementById('hex-error')!,
	analysis: document.getElementById('analysis')!,
	scriptVersion: document.getElementById('script-version') as HTMLSelectElement,
	scriptRules: document.getElementById('script-rules') as HTMLSelectElement,
	webcryptoError: document.getElementById('webcrypto-error')!,
	chainImport: document.getElementById('chain-import') as HTMLInputElement,
	chainImportButton: document.getElementById('chain-import-button')!
};

html.webcryptoError.hidden = window.isSecureContext;

[ 'keydown', 'keypress', 'keyup' ].forEach(evType => {
	html.asm.addEventListener(evType, asmUpdate);
	html.hex.addEventListener(evType, hexUpdate);
});

function asmUpdate() {
	try {
		const hex = (html.hex.innerHTML = asmtohex(html.asm.innerText));
		runAnalyzer(parseHexScript(hex));
		html.hexError.innerText = '';
		html.asmError.innerText = '';
	} catch (e) {
		if (typeof e === 'string') {
			html.asmError.innerText = e;
		} else {
			throw e;
		}
	}
}

function hexUpdate() {
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
		html.asmError.innerText = '';
		html.hexError.innerText = '';
	} catch (e) {
		if (typeof e === 'string') {
			html.hexError.innerText = e;
		} else {
			throw e;
		}
	}
}

function runAnalyzer(script: Script) {
	try {
		html.analysis.innerText = ScriptAnalyzer.analyzeScript(script);
	} catch (e) {
		console.error('ScriptAnalyzer error', e);
	}
}

html.chainImportButton.addEventListener('click', e => {
	const address = html.chainImport.value;
	getScript(address).then(hex => {
		html.hex.innerHTML = hex;
		hexUpdate();
	});
});

enum ScriptVersion {
	LEGACY,
	SEGWITV0,
	SEGWITV1
}

function getScriptVersion(): ScriptVersion {
	return html.scriptVersion.selectedIndex;
}

enum ScriptRules {
	ALL,
	CONSENSUS_ONLY
}

function getScriptRules(): ScriptRules {
	return html.scriptRules.selectedIndex;
}
