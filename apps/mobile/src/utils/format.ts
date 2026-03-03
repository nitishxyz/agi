type FormatUsdOptions = {
	compact?: boolean;
	signed?: boolean;
	minimumFractionDigits?: number;
	maximumFractionDigits?: number;
};

export function formatUsd(
	value: number | null | undefined,
	options?: FormatUsdOptions,
): string {
	const safe = value ?? 0;
	const {
		compact,
		signed,
		minimumFractionDigits = 2,
		maximumFractionDigits = 2,
	} = options ?? {};

	if (compact) {
		if (safe >= 1_000_000_000)
			return `${signed && safe > 0 ? '+' : ''}$${(safe / 1_000_000_000).toFixed(1)}B`;
		if (safe >= 1_000_000)
			return `${signed && safe > 0 ? '+' : ''}$${(safe / 1_000_000).toFixed(1)}M`;
		if (safe >= 1_000)
			return `${signed && safe > 0 ? '+' : ''}$${(safe / 1_000).toFixed(1)}K`;
	}

	const formatted = safe.toLocaleString(undefined, {
		minimumFractionDigits,
		maximumFractionDigits,
	});
	const prefix = signed && safe > 0 ? '+' : '';
	return `${prefix}$${formatted}`;
}

type FormatTokenAmountOptions = {
	decimals?: number;
	symbol?: string;
};

export function formatTokenAmount(
	amount: number | null | undefined,
	options?: FormatTokenAmountOptions,
): string {
	const safe = amount ?? 0;
	const { decimals = 4, symbol } = options ?? {};

	let formatted: string;
	if (safe >= 1) {
		formatted = safe.toLocaleString(undefined, {
			maximumFractionDigits: decimals,
		});
	} else if (safe === 0) {
		formatted = '0';
	} else {
		formatted = safe.toFixed(Math.min(decimals, 6));
	}

	return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatCompact(
	value: number | null | undefined,
	prefix = '$',
): string {
	const safe = value ?? 0;

	if (safe >= 1_000_000_000)
		return `${prefix}${(safe / 1_000_000_000).toFixed(1)}B`;
	if (safe >= 1_000_000) return `${prefix}${(safe / 1_000_000).toFixed(1)}M`;
	if (safe >= 1_000) return `${prefix}${(safe / 1_000).toFixed(1)}K`;
	return `${prefix}${safe.toFixed(0)}`;
}

type FormatPercentOptions = {
	signed?: boolean;
	decimals?: number;
};

export function formatPercent(
	value: number | null | undefined,
	options?: FormatPercentOptions,
): string {
	const safe = value ?? 0;
	const { signed = false, decimals = 1 } = options ?? {};

	const formatted = safe.toFixed(decimals);
	const prefix = signed && safe > 0 ? '+' : '';
	return `${prefix}${formatted}%`;
}

export function formatPrice(probability: number): string {
	return `${Math.round(probability * 100)}¢`;
}

export function formatDollars(amount: number): string {
	return `$${Math.round(amount)}`;
}

export function formatUsdcBalance(amount: number): string {
	if (amount >= 1000) {
		return `$${(amount / 1000).toFixed(1)}k`;
	}
	return `$${amount.toFixed(2)}`;
}

type TruncateAddressOptions = {
	startChars?: number;
	endChars?: number;
};

export function truncateAddress(
	address: string | null | undefined,
	options?: TruncateAddressOptions,
): string {
	if (!address) return '...';
	const { startChars = 4, endChars = 4 } = options ?? {};

	if (address.length <= startChars + endChars + 3) return address;
	return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export function formatBalance(
	value: number | null | undefined,
	decimals = 4,
): string {
	const safe = value ?? 0;
	if (safe === 0) return '0';
	if (safe >= 1) {
		return safe.toLocaleString(undefined, { maximumFractionDigits: decimals });
	}
	return safe.toFixed(Math.min(decimals, 6));
}

export function formatAtomicAmount(atomic: string, decimals: number): string {
	if (!atomic) return '0';
	const negative = atomic.startsWith('-');
	const digits = negative ? atomic.slice(1) : atomic;
	if (decimals === 0) return negative ? `-${digits}` : digits;
	const padded = digits.padStart(decimals + 1, '0');
	const whole = padded.slice(0, -decimals) || '0';
	const fractionRaw = padded.slice(-decimals).replace(/0+$/, '');
	const result = fractionRaw.length > 0 ? `${whole}.${fractionRaw}` : whole;
	return negative ? `-${result}` : result;
}

/**
 * Normalizes a timestamp to milliseconds.
 * DFlow API sends timestamps in milliseconds, but this handles both seconds and ms.
 */
export function normalizeTimestampMs(
	timestamp: number | string | null | undefined,
): number | null {
	if (timestamp == null) return null;

	const n = typeof timestamp === 'number' ? timestamp : Number(timestamp);
	if (!Number.isFinite(n) || n <= 0) return null;

	// If timestamp is in seconds (before year 2001 in ms), convert to ms
	// Timestamps > 1e12 are already in milliseconds
	if (n < 1_000_000_000_000) {
		return n * 1000;
	}
	return n;
}

/**
 * Formats a timestamp (in ms or seconds) to local time string.
 * Handles DFlow API timestamps which can be in either format.
 */
export function formatTradeTime(
	timestamp: number | string | null | undefined,
): string {
	const ms = normalizeTimestampMs(timestamp);
	if (ms == null) return '—';

	const date = new Date(ms);
	if (isNaN(date.getTime())) return '—';

	return date.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
	});
}

/**
 * Formats a timestamp to local date and time string.
 */
export function formatTradeDateTime(
	timestamp: number | string | null | undefined,
): string {
	const ms = normalizeTimestampMs(timestamp);
	if (ms == null) return '—';

	const date = new Date(ms);
	if (isNaN(date.getTime())) return '—';

	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const isYesterday = date.toDateString() === yesterday.toDateString();

	const timeStr = date.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
	});

	if (isToday) return timeStr;
	if (isYesterday) return `Yesterday ${timeStr}`;

	const dateStr = date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	});

	return `${dateStr} ${timeStr}`;
}

/**
 * Formats a relative time ago string (e.g., "2m ago", "1h ago").
 */
export function formatTimeAgo(
	timestamp: number | string | null | undefined,
): string {
	const ms = normalizeTimestampMs(timestamp);
	if (ms == null) return '—';

	const now = Date.now();
	const diff = now - ms;

	if (diff < 0) return 'just now';

	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return 'just now';

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;

	const weeks = Math.floor(days / 7);
	if (weeks < 4) return `${weeks}w ago`;

	const months = Math.floor(days / 30);
	return `${months}mo ago`;
}

/**
 * Formats a close time to a short date format (e.g., "Dec 25").
 */
export function formatCloseDate(
	timestamp: number | string | null | undefined,
): string {
	const ms = normalizeTimestampMs(timestamp);
	if (ms == null) return '—';

	const date = new Date(ms);
	if (isNaN(date.getTime())) return '—';

	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	});
}
