function hashCode(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash);
}

const gradients = [
	['#667eea', '#764ba2'],
	['#f093fb', '#f5576c'],
	['#4facfe', '#00f2fe'],
	['#43e97b', '#38f9d7'],
	['#fa709a', '#fee140'],
	['#a8edea', '#fed6e3'],
	['#667eea', '#764ba2'],
	['#ff9a9e', '#fecfef'],
	['#a18cd1', '#fbc2eb'],
	['#ffecd2', '#fcb69f'],
];

export function generateGradient(shareId: string): string {
	const index = hashCode(shareId) % gradients.length;
	const [from, to] = gradients[index];
	return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
