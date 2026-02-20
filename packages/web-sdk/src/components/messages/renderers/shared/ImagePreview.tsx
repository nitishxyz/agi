import { useState } from 'react';
import { ImageIcon, X } from 'lucide-react';

interface ImageData {
	data: string;
	mimeType: string;
}

interface ImagePreviewProps {
	images: ImageData[];
}

export function ImagePreview({ images }: ImagePreviewProps) {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	if (images.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 mt-2">
			{images.map((img, i) => {
				const src = `data:${img.mimeType};base64,${img.data}`;
				const isExpanded = expandedIndex === i;

				return (
					<div key={`img-${i}-${img.mimeType}`} className="relative">
						{isExpanded ? (
							<div className="relative">
								<button
									type="button"
									onClick={() => setExpandedIndex(null)}
									className="absolute top-1 right-1 z-10 p-0.5 rounded bg-black/60 text-white hover:bg-black/80 transition-colors"
								>
									<X className="h-3 w-3" />
								</button>
								<img
									src={src}
									alt={`Tool result ${i + 1}`}
									className="max-w-full max-h-[32rem] rounded-lg border border-border object-contain"
								/>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setExpandedIndex(i)}
								className="group relative overflow-hidden rounded-lg border border-border hover:border-foreground/30 transition-colors"
							>
								<img
									src={src}
									alt={`Tool result ${i + 1}`}
									className="w-48 h-32 object-cover"
								/>
								<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
									<ImageIcon className="h-5 w-5 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
								</div>
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}
