import type { SecurityNotice } from './types.ts';

const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const BASE64_REGEX =
	/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
const DATA_URI_REGEX = /data:[a-z]+\/[a-z]+;base64,/gi;

const INVISIBLE_CODEPOINTS = new Set([
	0x200b, 0x200c, 0x200d, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff,
	0x00ad, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066,
	0x2067, 0x2068, 0x2069,
]);

const SUSPICIOUS_PATTERNS = [
	/system\s*:\s*/i,
	/\bignore\s+(previous|above|all)\s+(instructions?|prompts?)\b/i,
	/\byou\s+are\s+now\b/i,
	/\brole\s*:\s*(system|assistant)\b/i,
	/\bdo\s+not\s+mention\b/i,
	/\bpretend\s+you\s+are\b/i,
	/\bact\s+as\s+(if|a|an|though)\b/i,
	/\boverride\b.*\b(instructions?|rules?|safety)\b/i,
	/\bsecretly\b/i,
	/\bhidden\s+instruction\b/i,
];

function countInvisibleChars(str: string): number {
	let count = 0;
	for (const ch of str) {
		const cp = ch.codePointAt(0);
		if (cp !== undefined && INVISIBLE_CODEPOINTS.has(cp)) {
			count++;
		}
	}
	return count;
}

export function scanContent(content: string): SecurityNotice[] {
	const notices: SecurityNotice[] = [];
	const lines = content.split('\n');

	const commentRegex = new RegExp(HTML_COMMENT_REGEX.source, 'g');
	for (;;) {
		const match = commentRegex.exec(content);
		if (match === null) break;

		const commentBody = match[0].slice(4, -3).trim();
		if (!commentBody) continue;

		const lineNum = content.slice(0, match.index).split('\n').length;
		const isSuspicious = SUSPICIOUS_PATTERNS.some((p) => p.test(commentBody));

		if (isSuspicious) {
			notices.push({
				type: 'hidden_instruction',
				description: `HTML comment at line ${lineNum} contains suspicious instruction-like content: "${truncate(commentBody, 100)}"`,
				line: lineNum,
			});
		} else if (commentBody.length > 20) {
			notices.push({
				type: 'html_comment',
				description: `HTML comment at line ${lineNum} (${commentBody.length} chars) — hidden from rendered view: "${truncate(commentBody, 80)}"`,
				line: lineNum,
			});
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';

		if (DATA_URI_REGEX.test(line)) {
			notices.push({
				type: 'data_uri',
				description: `Data URI detected at line ${i + 1} — may embed hidden content`,
				line: i + 1,
			});
		}

		const b64Matches = line.match(BASE64_REGEX);
		if (b64Matches) {
			for (const b64 of b64Matches) {
				if (b64.length > 100) {
					notices.push({
						type: 'base64_content',
						description: `Large base64 string (${b64.length} chars) at line ${i + 1} — may contain hidden instructions`,
						line: i + 1,
					});
				}
			}
		}

		const invisibleCount = countInvisibleChars(line);
		if (invisibleCount > 0) {
			notices.push({
				type: 'invisible_chars',
				description: `${invisibleCount} invisible Unicode character(s) at line ${i + 1} — may hide content from visual inspection`,
				line: i + 1,
			});
		}
	}

	return notices;
}

function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, maxLen)}…`;
}
