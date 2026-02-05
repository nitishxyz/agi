import qrcode from 'qrcode-terminal';

export function generateQRCode(data: string): Promise<string> {
	return new Promise((resolve) => {
		qrcode.generate(data, { small: true }, (qr: string) => {
			resolve(qr);
		});
	});
}

export async function printQRCode(data: string, label?: string): Promise<void> {
	const qr = await generateQRCode(data);
	console.log('');
	if (label) {
		console.log(`  ${label}`);
	}
	console.log(qr);
	console.log(`  ${data}`);
	console.log('');
}
