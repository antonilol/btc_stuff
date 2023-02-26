const html = {
	asm: document.getElementById('asm') as HTMLDivElement,
	asmError: document.getElementById('asm-error') as HTMLPreElement,
	hex: document.getElementById('hex') as HTMLDivElement,
	hexError: document.getElementById('hex-error') as HTMLPreElement,
	analysis: document.getElementById('analysis') as HTMLDivElement,
	scriptVersion: document.getElementById('script-version') as HTMLSelectElement,
	scriptRules: document.getElementById('script-rules') as HTMLSelectElement,
	webcryptoError: document.getElementById('webcrypto-error') as HTMLDivElement,
	chainImport: document.getElementById('chain-import') as HTMLInputElement,
	chainImportButton: document.getElementById('chain-import-button') as HTMLButtonElement,
	chainImportError: document.getElementById('chain-import-error') as HTMLSpanElement,
	chainImportURL: document.getElementById('chain-import-url') as HTMLInputElement
};

html.webcryptoError.hidden = window.isSecureContext;

[ 'keydown', 'keypress', 'keyup' ].forEach(evType => {
	html.asm.addEventListener(evType, asmUpdate);
	html.hex.addEventListener(evType, hexUpdate);
});

let script: Script = [];
function asmUpdate() {
	try {
		const hex = (html.hex.innerText = asmtohex(html.asm.innerText));
		script = parseHexScript(hex);
		html.hexError.innerText = '';
		html.asmError.innerText = '';
	} catch (e) {
		if (typeof e === 'string') {
			html.asmError.innerText = e;
		} else {
			throw e;
		}
	}
	runAnalyzer();
}

function hexUpdate() {
	try {
		script = parseHexScript(html.hex.innerText);
		html.asm.innerHTML = '';
		scriptToAsm(script).forEach(e => {
			const span = document.createElement('span');
			span.innerText = e.s;
			span.classList.add(`script-${OpcodeType[e.t].toLowerCase()}`);
			html.asm.appendChild(span);
			html.asm.appendChild(document.createElement('br'));
		});
		html.asmError.innerText = '';
		html.hexError.innerText = '';
	} catch (e) {
		if (typeof e === 'string') {
			html.hexError.innerText = e;
		} else {
			throw e;
		}
	}
	runAnalyzer();
}

function runAnalyzer() {
	try {
		html.analysis.innerText = ScriptAnalyzer.analyzeScript(script);
	} catch (e) {
		console.error('ScriptAnalyzer error', e);
	}
}

html.chainImportButton.addEventListener('click', async () => {
	const address = html.chainImport.value;
	const apiURL = html.chainImportURL.value;
	let script: Awaited<ReturnType<typeof getScript>>;
	try {
		script = await getScript(apiURL, address);
	} catch (e) {
		html.chainImportError.innerText = e instanceof Error ? e.message : String(e);
		return;
	}
	html.chainImportError.innerText = '';
	html.hex.innerText = script.hex;
	html.scriptVersion.selectedIndex = script.version;
	hexUpdate();
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

[ html.scriptVersion, html.scriptRules ].forEach(el => el.addEventListener('change', runAnalyzer));
