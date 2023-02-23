const apiURL = 'https://mempool.space';

function get(url: string): Promise<string> {
	return new Promise(resolve => {
		const req = new XMLHttpRequest();
		req.addEventListener('load', function () {
			resolve(this.responseText);
		});
		req.open('GET', url);
		req.send();
	});
}

async function getScript(address: string): Promise<string> {
	const txs = JSON.parse(await get(`${apiURL}/api/address/${address}/txs`));
	for (const tx of txs) {
		for (const input of tx.vin) {
			if (input.prevout.scriptpubkey_address !== address) {
				continue;
			}
			switch (input.prevout.scriptpubkey_type) {
				case 'v0_p2wsh':
					return input.witness[input.witness.length - 1];
			}
		}
	}

	// TODO message
	throw new Error('error');
}
