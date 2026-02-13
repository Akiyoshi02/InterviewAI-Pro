import { useEffect, useMemo, useRef } from 'react';
import { onValue, ref as dbRef } from 'firebase/database';
import { realtimeDb } from '../config/firebase.js';

const normalizeFeedEntry = (entry = {}) => ({
  interviewId: typeof entry?.interviewId === 'string' ? entry.interviewId : null,
  lastEventId: typeof entry?.lastEventId === 'string' ? entry.lastEventId : '',
  lastEventType: typeof entry?.lastEventType === 'string' ? entry.lastEventType.trim() : '',
  lastEventAt: entry?.lastEventAt || '',
  status: entry?.status || '',
  updatedAt: entry?.updatedAt || '',
});

const buildFeedMap = (feed = {}) => (
  new Map(
    Object.entries(feed || {}).map(([interviewId, value]) => [
      interviewId,
      normalizeFeedEntry(value),
    ]),
  )
);

const buildFeedSignature = (feedMap = new Map()) =>
  JSON.stringify(
    Array.from(feedMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([interviewId, value]) => [
        interviewId,
        value?.lastEventId || '',
        value?.lastEventType || '',
        value?.lastEventAt || '',
        value?.status || '',
        value?.updatedAt || '',
      ]),
  );

const resolveChangedEntries = (previousFeedMap = new Map(), nextFeedMap = new Map()) => {
  const changedEntries = [];
  const interviewIds = new Set([
    ...previousFeedMap.keys(),
    ...nextFeedMap.keys(),
  ]);

  interviewIds.forEach((interviewId) => {
    const previousEntry = previousFeedMap.get(interviewId);
    const nextEntry = nextFeedMap.get(interviewId);
    const hasChanged = !previousEntry
      || !nextEntry
      || previousEntry.lastEventId !== nextEntry.lastEventId
      || previousEntry.lastEventType !== nextEntry.lastEventType
      || previousEntry.lastEventAt !== nextEntry.lastEventAt
      || previousEntry.status !== nextEntry.status
      || previousEntry.updatedAt !== nextEntry.updatedAt;

    if (!hasChanged) return;

    changedEntries.push({
      interviewId,
      ...nextEntry,
      removed: !nextEntry,
    });
  });

  return changedEntries;
};

const buildEventTypeKey = (eventTypes) => {
  if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
    return '';
  }

  return Array.from(
    new Set(
      eventTypes
        .map((eventType) => (typeof eventType === 'string' ? eventType.toLowerCase().trim() : ''))
        .filter(Boolean),
    ),
  )
    .sort()
    .join('|');
};

/**
 * Subscribe to per-user interview realtime feed updates.
 * Calls onFeedUpdate whenever the feed changes.
 */
export const useInterviewRealtimeFeed = ({
  userId,
  enabled = true,
  eventTypes = null,
  onFeedUpdate,
}) => {
  const callbackRef = useRef(onFeedUpdate);
  const lastSignatureRef = useRef('');
  const lastFeedMapRef = useRef(new Map());
  const hasInitializedRef = useRef(false);
  const eventTypeKey = buildEventTypeKey(eventTypes);
  const normalizedEventTypes = useMemo(() => (
    eventTypeKey
      ? new Set(eventTypeKey.split('|'))
      : null
  ), [eventTypeKey]);

  useEffect(() => {
    callbackRef.current = onFeedUpdate;
  }, [onFeedUpdate]);

  const feedPath = useMemo(
    () => (userId ? `userInterviewFeeds/${userId}` : null),
    [userId],
  );

  useEffect(() => {
    if (!enabled || !feedPath || !realtimeDb) {
      hasInitializedRef.current = false;
      lastSignatureRef.current = '';
      lastFeedMapRef.current = new Map();
      return undefined;
    }

    const feedRef = dbRef(realtimeDb, feedPath);
    const unsubscribe = onValue(
      feedRef,
      (snapshot) => {
        const feed = snapshot.val() || {};
        const nextFeedMap = buildFeedMap(feed);
        const signature = buildFeedSignature(nextFeedMap);
        if (signature === lastSignatureRef.current) {
          return;
        }

        const isInitial = !hasInitializedRef.current;
        const changedEntries = resolveChangedEntries(lastFeedMapRef.current, nextFeedMap);
        lastSignatureRef.current = signature;
        lastFeedMapRef.current = nextFeedMap;

        const shouldFilterByEventType = Boolean(
          !isInitial
          && normalizedEventTypes
          && normalizedEventTypes.size > 0,
        );
        if (shouldFilterByEventType) {
          const hasMatchingEvent = changedEntries.some((entry) => (
            typeof entry?.lastEventType === 'string'
            && normalizedEventTypes.has(entry.lastEventType.toLowerCase())
          ));
          if (!hasMatchingEvent) {
            hasInitializedRef.current = true;
            return;
          }
        }

        if (typeof callbackRef.current === 'function') {
          callbackRef.current(feed, { initial: isInitial, changedEntries });
        }
        hasInitializedRef.current = true;
      },
      () => {
        // Keep fail-open behavior: caller still has HTTP/manual refresh.
      },
    );

    return () => {
      hasInitializedRef.current = false;
      lastSignatureRef.current = '';
      lastFeedMapRef.current = new Map();
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [enabled, eventTypeKey, feedPath, normalizedEventTypes]);
};

export default useInterviewRealtimeFeed;
