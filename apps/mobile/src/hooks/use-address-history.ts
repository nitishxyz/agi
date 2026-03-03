import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import db from '@/db/index';
import { walletActivityEvents } from '@/db/schema';
import { eq, desc, isNotNull, and, inArray } from 'drizzle-orm';
import { getWallet } from '@/services/wallet';
import { getOrCreateWallet } from '@/utils/wallet-db';

export interface AddressHistoryItem {
	address: string;
	lastInteraction: Date;
	interactionCount: number;
	sentCount: number;
	receivedCount: number;
	lastTransactionType: 'sent' | 'received';
}

export interface AddressHistorySection {
	title: string;
	data: AddressHistoryItem[];
}

export function useAddressHistory() {
	const [walletId, setWalletId] = useState<string | null>(null);

	useEffect(() => {
		async function init() {
			const w = await getWallet();
			if (w?.publicKey) {
				const wallet = await getOrCreateWallet(w.publicKey);
				setWalletId(wallet.id);
			}
		}
		init();
	}, []);

	return useQuery({
		queryKey: ['addressHistory', walletId],
		queryFn: async (): Promise<AddressHistoryItem[]> => {
			if (!walletId) return [];

			const events = await db
				.select()
				.from(walletActivityEvents)
				.where(
					and(
						eq(walletActivityEvents.walletId, walletId),
						isNotNull(walletActivityEvents.counterparty),
						inArray(walletActivityEvents.type, ['send', 'receive']),
					),
				)
				.orderBy(desc(walletActivityEvents.blockTime))
				.limit(200);

			const addressMap = new Map<
				string,
				{
					lastInteraction: Date;
					sentCount: number;
					receivedCount: number;
					lastTransactionType: 'sent' | 'received';
				}
			>();

			for (const event of events) {
				if (!event.counterparty) continue;

				const existing = addressMap.get(event.counterparty);
				const eventDate = event.blockTime
					? new Date(event.blockTime * 1000)
					: new Date();
				const isSent = event.type === 'send';

				if (existing) {
					if (isSent) {
						existing.sentCount += 1;
					} else {
						existing.receivedCount += 1;
					}
					if (eventDate > existing.lastInteraction) {
						existing.lastInteraction = eventDate;
						existing.lastTransactionType = isSent ? 'sent' : 'received';
					}
				} else {
					addressMap.set(event.counterparty, {
						lastInteraction: eventDate,
						sentCount: isSent ? 1 : 0,
						receivedCount: isSent ? 0 : 1,
						lastTransactionType: isSent ? 'sent' : 'received',
					});
				}
			}

			const items: AddressHistoryItem[] = Array.from(addressMap.entries())
				.map(([address, data]) => ({
					address,
					lastInteraction: data.lastInteraction,
					interactionCount: data.sentCount + data.receivedCount,
					sentCount: data.sentCount,
					receivedCount: data.receivedCount,
					lastTransactionType: data.lastTransactionType,
				}))
				.sort(
					(a, b) => b.lastInteraction.getTime() - a.lastInteraction.getTime(),
				)
				.slice(0, 20);

			return items;
		},
		enabled: !!walletId,
		staleTime: 60000,
	});
}

// Helper to group addresses into sections by time
export function useAddressHistorySections(
	data: AddressHistoryItem[] | undefined,
): AddressHistorySection[] {
	return useMemo(() => {
		if (!data || data.length === 0) return [];

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
		const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
		const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

		const sections: { [key: string]: AddressHistoryItem[] } = {
			Today: [],
			Yesterday: [],
			'Last 7 Days': [],
			'Last 30 Days': [],
			Older: [],
		};

		for (const item of data) {
			const itemDate = item.lastInteraction;

			if (itemDate >= today) {
				sections['Today'].push(item);
			} else if (itemDate >= yesterday) {
				sections['Yesterday'].push(item);
			} else if (itemDate >= lastWeek) {
				sections['Last 7 Days'].push(item);
			} else if (itemDate >= lastMonth) {
				sections['Last 30 Days'].push(item);
			} else {
				sections['Older'].push(item);
			}
		}

		// Convert to array, filtering out empty sections
		const result: AddressHistorySection[] = [];
		const sectionOrder = [
			'Today',
			'Yesterday',
			'Last 7 Days',
			'Last 30 Days',
			'Older',
		];

		for (const title of sectionOrder) {
			if (sections[title].length > 0) {
				result.push({
					title,
					data: sections[title],
				});
			}
		}

		return result;
	}, [data]);
}
