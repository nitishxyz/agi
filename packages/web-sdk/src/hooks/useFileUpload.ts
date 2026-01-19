import {
	useState,
	useCallback,
	useEffect,
	type DragEvent,
	type ClipboardEvent,
} from 'react';

export type FileAttachmentType = 'image' | 'pdf' | 'text';

export interface FileAttachment {
	id: string;
	file: File;
	type: FileAttachmentType;
	name: string;
	preview?: string;
	data: string;
	mediaType: string;
	textContent?: string;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const PDF_TYPES = ['application/pdf'];
const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown'];

const SUPPORTED_TYPES = [...IMAGE_TYPES, ...PDF_TYPES, ...TEXT_TYPES];

function generateId(): string {
	return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getFileType(file: File): FileAttachmentType | null {
	if (IMAGE_TYPES.includes(file.type)) return 'image';
	if (PDF_TYPES.includes(file.type)) return 'pdf';
	if (TEXT_TYPES.includes(file.type)) return 'text';
	const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
	if (TEXT_EXTENSIONS.includes(ext)) return 'text';
	return null;
}

function isSupported(file: File): boolean {
	if (SUPPORTED_TYPES.includes(file.type)) return true;
	const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
	return TEXT_EXTENSIONS.includes(ext);
}

async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			const base64 = result.split(',')[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

async function fileToText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

async function fileToPreview(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

interface UseFileUploadOptions {
	maxFiles?: number;
	maxSizeMB?: number;
	pageWide?: boolean;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
	const { maxFiles = 10, maxSizeMB = 10, pageWide = true } = options;

	const [files, setFiles] = useState<FileAttachment[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const maxSizeBytes = maxSizeMB * 1024 * 1024;

	const validateFile = useCallback(
		(file: File): string | null => {
			if (!isSupported(file)) {
				return `Unsupported file type: ${file.type || file.name}. Supported: images, PDF, markdown, text`;
			}
			if (file.size > maxSizeBytes) {
				return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${maxSizeMB}MB`;
			}
			return null;
		},
		[maxSizeBytes, maxSizeMB],
	);

	const addFiles = useCallback(
		async (inputFiles: FileList | File[]) => {
			setError(null);
			const fileArray = Array.from(inputFiles);
			const remaining = maxFiles - files.length;

			if (remaining <= 0) {
				setError(`Maximum ${maxFiles} files allowed`);
				return;
			}

			const filesToAdd = fileArray.slice(0, remaining);
			const newFiles: FileAttachment[] = [];

			for (const file of filesToAdd) {
				const validationError = validateFile(file);
				if (validationError) {
					setError(validationError);
					continue;
				}

				const fileType = getFileType(file);
				if (!fileType) continue;

				try {
					let preview: string | undefined;
					let data: string;
					let textContent: string | undefined;
					let mediaType = file.type;

					if (fileType === 'image') {
						[preview, data] = await Promise.all([
							fileToPreview(file),
							fileToBase64(file),
						]);
					} else if (fileType === 'pdf') {
						data = await fileToBase64(file);
						mediaType = 'application/pdf';
					} else {
						textContent = await fileToText(file);
						data = textContent;
						if (!mediaType) {
							const ext = file.name.toLowerCase();
							mediaType =
								ext.endsWith('.md') || ext.endsWith('.markdown')
									? 'text/markdown'
									: 'text/plain';
						}
					}

					newFiles.push({
						id: generateId(),
						file,
						type: fileType,
						name: file.name,
						preview,
						data,
						mediaType,
						textContent,
					});
				} catch {
					setError(`Failed to process file: ${file.name}`);
				}
			}

			if (newFiles.length > 0) {
				setFiles((prev) => [...prev, ...newFiles]);
			}
		},
		[files.length, maxFiles, validateFile],
	);

	const removeFile = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
		setError(null);
	}, []);

	const clearFiles = useCallback(() => {
		setFiles([]);
		setError(null);
	}, []);

	const handleDragEnter = useCallback((e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer.types.includes('Files')) {
			setIsDragging(true);
		}
	}, []);

	const handleDragLeave = useCallback((e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;
		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
			setIsDragging(false);
		}
	}, []);

	const handleDragOver = useCallback((e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const droppedFiles = e.dataTransfer.files;
			if (droppedFiles.length > 0) {
				const supportedFiles = Array.from(droppedFiles).filter(isSupported);
				if (supportedFiles.length > 0) {
					addFiles(supportedFiles);
				}
			}
		},
		[addFiles],
	);

	const handlePaste = useCallback(
		(e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			const pastedFiles: File[] = [];
			for (const item of Array.from(items)) {
				if (item.kind === 'file') {
					const file = item.getAsFile();
					if (file && isSupported(file)) {
						pastedFiles.push(file);
					}
				}
			}

			if (pastedFiles.length > 0) {
				e.preventDefault();
				addFiles(pastedFiles);
			}
		},
		[addFiles],
	);

	useEffect(() => {
		if (!pageWide) return;

		let dragCounter = 0;

		const onDragEnter = (e: globalThis.DragEvent) => {
			e.preventDefault();
			if (e.dataTransfer?.types.includes('Files')) {
				dragCounter++;
				if (dragCounter === 1) {
					setIsDragging(true);
				}
			}
		};

		const onDragLeave = (e: globalThis.DragEvent) => {
			e.preventDefault();
			dragCounter--;
			if (dragCounter === 0) {
				setIsDragging(false);
			}
		};

		const onDragOver = (e: globalThis.DragEvent) => {
			e.preventDefault();
		};

		const onDrop = (e: globalThis.DragEvent) => {
			e.preventDefault();
			dragCounter = 0;
			setIsDragging(false);

			const droppedFiles = e.dataTransfer?.files;
			if (droppedFiles && droppedFiles.length > 0) {
				const supportedFiles = Array.from(droppedFiles).filter(isSupported);
				if (supportedFiles.length > 0) {
					addFiles(supportedFiles);
				}
			}
		};

		document.addEventListener('dragenter', onDragEnter);
		document.addEventListener('dragleave', onDragLeave);
		document.addEventListener('dragover', onDragOver);
		document.addEventListener('drop', onDrop);

		return () => {
			document.removeEventListener('dragenter', onDragEnter);
			document.removeEventListener('dragleave', onDragLeave);
			document.removeEventListener('dragover', onDragOver);
			document.removeEventListener('drop', onDrop);
		};
	}, [pageWide, addFiles]);

	const images = files.filter((f) => f.type === 'image');
	const documents = files.filter((f) => f.type === 'pdf' || f.type === 'text');

	return {
		files,
		images,
		documents,
		isDragging,
		error,
		addFiles,
		removeFile,
		clearFiles,
		handleDragEnter,
		handleDragLeave,
		handleDragOver,
		handleDrop,
		handlePaste,
	};
}
