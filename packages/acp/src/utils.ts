import type { Writable, Readable } from "node:stream";

export function nodeToWebWritable(
	nodeWritable: Writable | typeof process.stdout,
): WritableStream<Uint8Array> {
	return new WritableStream({
		write(chunk) {
			return new Promise<void>((resolve, reject) => {
				const ok = (nodeWritable as Writable).write(chunk, (err) => {
					if (err) reject(err);
				});
				if (ok) {
					resolve();
				} else {
					(nodeWritable as Writable).once("drain", resolve);
				}
			});
		},
		close() {
			return new Promise<void>((resolve) => {
				(nodeWritable as Writable).end(resolve);
			});
		},
	});
}

export function nodeToWebReadable(
	nodeReadable: Readable | typeof process.stdin,
): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			(nodeReadable as Readable).on("data", (chunk: Buffer) => {
				controller.enqueue(new Uint8Array(chunk));
			});
			(nodeReadable as Readable).on("end", () => {
				controller.close();
			});
			(nodeReadable as Readable).on("error", (err) => {
				controller.error(err);
			});
		},
		cancel() {
			(nodeReadable as Readable).destroy();
		},
	});
}
