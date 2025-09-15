import type { AGIEvent } from '@/server/events/types.ts';

type Subscriber = (evt: AGIEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>(); // sessionId -> subs

export function publish(event: AGIEvent) {
  const subs = subscribers.get(event.sessionId);
  if (!subs) return;
  for (const sub of subs) {
    try {
      sub(event);
    } catch {}
  }
}

export function subscribe(sessionId: string, handler: Subscriber) {
  let set = subscribers.get(sessionId);
  if (!set) {
    set = new Set();
    subscribers.set(sessionId, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
    if (set && set.size === 0) subscribers.delete(sessionId);
  };
}

