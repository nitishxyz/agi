import { useState, useCallback } from 'react';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface ImageAttachment {
	id: string;
	data: string;
	mediaType: string;
	name: string;
}

export interface FileAttachment {
	id: string;
	type: string;
	name: string;
	data: string;
	mediaType: string;
	textContent?: string;
}

function getMediaType(ext: string): string {
	const map: Record<string, string> = {
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.bmp': 'image/bmp',
		'.pdf': 'application/pdf',
		'.json': 'application/json',
		'.md': 'text/markdown',
		'.markdown': 'text/markdown',
	};
	return map[ext] || 'text/plain';
}

export function isFilePath(text: string): boolean {
	if (text.includes('\n')) return false;
	if (text.length > 4096) return false;
	try {
		const resolved = resolve(text);
		const stat = statSync(resolved);
		return stat.isFile();
	} catch {
		return false;
	}
}

export function useFileAttachments() {
	const [images, setImages] = useState<ImageAttachment[]>([]);
	const [files, setFiles] = useState<FileAttachment[]>([]);

	const addFromPath = useCallback((rawPath: string): boolean => {
		const filePath = resolve(rawPath);
		if (!existsSync(filePath)) return false;

		try {
			const stat = statSync(filePath);
			if (!stat.isFile()) return false;
			if (stat.size > MAX_FILE_SIZE) return false;
		} catch {
			return false;
		}

		const ext = extname(filePath).toLowerCase();
		const name = basename(filePath);
		const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

		try {
			if (IMAGE_EXTENSIONS.includes(ext)) {
				const buf = readFileSync(filePath);
				setImages((prev) => [
					...prev,
					{
						id,
						data: buf.toString('base64'),
						mediaType: getMediaType(ext),
						name,
					},
				]);
				return true;
			}

			if (ext === '.pdf') {
				const buf = readFileSync(filePath);
				setFiles((prev) => [
					...prev,
					{
						id,
						type: 'pdf',
						name,
						data: buf.toString('base64'),
						mediaType: 'application/pdf',
					},
				]);
				return true;
			}

			const buf = readFileSync(filePath);
			const textContent = buf.toString('utf-8');
			setFiles((prev) => [
				...prev,
				{
					id,
					type: 'text',
					name,
					data: textContent,
					mediaType: getMediaType(ext),
					textContent,
				},
			]);
			return true;
		} catch {
			return false;
		}
	}, []);

	const remove = useCallback((id: string) => {
		setImages((prev) => prev.filter((i) => i.id !== id));
		setFiles((prev) => prev.filter((f) => f.id !== id));
	}, []);

	const clear = useCallback(() => {
		setImages([]);
		setFiles([]);
	}, []);

	const count = images.length + files.length;
	const names = [...images.map((i) => i.name), ...files.map((f) => f.name)];

	return { images, files, count, names, addFromPath, remove, clear };
}
