import {
	useState,
	useCallback,
	useEffect,
	type DragEvent,
	type ClipboardEvent,
} from 'react';

export interface ImageAttachment {
	id: string;
	file: File;
	preview: string;
	data: string;
	mediaType: string;
}

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function generateId(): string {
	return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

async function fileToPreview(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

interface UseImageUploadOptions {
	maxImages?: number;
	maxSizeMB?: number;
	pageWide?: boolean;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
	const { maxImages = 5, maxSizeMB = 5, pageWide = true } = options;

	const [images, setImages] = useState<ImageAttachment[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const maxSizeBytes = maxSizeMB * 1024 * 1024;

	const validateFile = useCallback(
		(file: File): string | null => {
			if (!SUPPORTED_TYPES.includes(file.type)) {
				return `Unsupported file type: ${file.type}. Supported: PNG, JPEG, GIF, WebP`;
			}
			if (file.size > maxSizeBytes) {
				return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${maxSizeMB}MB`;
			}
			return null;
		},
		[maxSizeBytes, maxSizeMB],
	);

	const addImages = useCallback(
		async (files: FileList | File[]) => {
			setError(null);
			const fileArray = Array.from(files);
			const remaining = maxImages - images.length;

			if (remaining <= 0) {
				setError(`Maximum ${maxImages} images allowed`);
				return;
			}

			const filesToAdd = fileArray.slice(0, remaining);
			const newImages: ImageAttachment[] = [];

			for (const file of filesToAdd) {
				const validationError = validateFile(file);
				if (validationError) {
					setError(validationError);
					continue;
				}

				try {
					const [preview, data] = await Promise.all([
						fileToPreview(file),
						fileToBase64(file),
					]);

					newImages.push({
						id: generateId(),
						file,
						preview,
						data,
						mediaType: file.type,
					});
				} catch {
					setError('Failed to process image');
				}
			}

			if (newImages.length > 0) {
				setImages((prev) => [...prev, ...newImages]);
			}
		},
		[images.length, maxImages, validateFile],
	);

	const removeImage = useCallback((id: string) => {
		setImages((prev) => prev.filter((img) => img.id !== id));
		setError(null);
	}, []);

	const clearImages = useCallback(() => {
		setImages([]);
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

			const files = e.dataTransfer.files;
			if (files.length > 0) {
				const imageFiles = Array.from(files).filter((f) =>
					f.type.startsWith('image/'),
				);
				if (imageFiles.length > 0) {
					addImages(imageFiles);
				}
			}
		},
		[addImages],
	);

	const handlePaste = useCallback(
		(e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			const imageFiles: File[] = [];
			for (const item of Array.from(items)) {
				if (item.type.startsWith('image/')) {
					const file = item.getAsFile();
					if (file) {
						imageFiles.push(file);
					}
				}
			}

			if (imageFiles.length > 0) {
				e.preventDefault();
				addImages(imageFiles);
			}
		},
		[addImages],
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

			const files = e.dataTransfer?.files;
			if (files && files.length > 0) {
				const imageFiles = Array.from(files).filter((f) =>
					f.type.startsWith('image/'),
				);
				if (imageFiles.length > 0) {
					addImages(imageFiles);
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
	}, [pageWide, addImages]);

	return {
		images,
		isDragging,
		error,
		addImages,
		removeImage,
		clearImages,
		handleDragEnter,
		handleDragLeave,
		handleDragOver,
		handleDrop,
		handlePaste,
	};
}
