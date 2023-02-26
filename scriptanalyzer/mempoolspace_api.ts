function get(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const req = new XMLHttpRequest();
		req.addEventListener('load', function () {
			if (this.status !== 200) {
				reject(new Error(`Received error ${this.status}\n${this.statusText}: ${this.responseText}`));
			} else {
				resolve(this.responseText);
			}
		});
		req.open('GET', url);
		req.send();
	});
}

async function getScript(apiURL: string, address: string): Promise<{ version: ScriptVersion; hex: string }> {
	const txs = JSON.parse(await get(`${apiURL}/api/address/${address}/txs`));
	for (const tx of txs) {
		for (const input of tx.vin) {
			if (!input.prevout || input.prevout.scriptpubkey_address !== address) {
				continue;
			}
			switch (input.prevout.scriptpubkey_type) {
				case 'v0_p2wsh':
					// witness script
					return { version: ScriptVersion.SEGWITV0, hex: input.witness[input.witness.length - 1] };
				case 'p2sh':
					if (input.inner_witnessscript_asm) {
						// witness script wrapped in p2sh
						return { version: ScriptVersion.SEGWITV0, hex: input.witness[input.witness.length - 1] };
					} else {
						// redeem script
						return { version: ScriptVersion.LEGACY, hex: Util.bufferToHex(getRedeemScript(input.scriptsig)) };
					}
				case 'v1_p2tr':
					if (input.witness.length >= 2 && input.witness[input.witness.length - 1].startsWith('50')) {
						// remove annex
						input.witness.pop();
					}
					if (input.witness.length >= 2) {
						// tapscript
						return { version: ScriptVersion.SEGWITV1, hex: input.witness[input.witness.length - 2] };
					}
					break;
			}
			throw new Error('No wrapped script found');
		}
	}

	throw new Error('No spending transaction found');
}
