import { useEffect, useMemo, useRef } from 'react';
import { onValue, ref as dbRef } from 'firebase/database';
import { realtimeDb } from '../config/firebase.js';

const buildFeedSignature = (feed = {}) => (
  `${feed?.lastEventId || ''}|${feed?.lastEventType || ''}|${feed?.lastEventAt || ''}|${feed?.updatedAt || ''}`
);

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
 * Generic RTDB feed listener for paths that expose a single feed object.
 */
export const useRealtimePathFeed = ({
  path,
  enabled = true,
  eventTypes = null,
  onFeedUpdate,
}) => {
  const callbackRef = useRef(onFeedUpdate);
  const lastSignatureRef = useRef('');
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

  useEffect(() => {
    if (!enabled || !path || !realtimeDb) {
      hasInitializedRef.current = false;
      lastSignatureRef.current = '';
      return undefined;
    }

    const feedRef = dbRef(realtimeDb, path);
    const unsubscribe = onValue(
      feedRef,
      (snapshot) => {
        const feed = snapshot.val() || {};
        const signature = buildFeedSignature(feed);
        if (signature === lastSignatureRef.current) return;

        lastSignatureRef.current = signature;
        const isInitial = !hasInitializedRef.current;
        const lastEventType = typeof feed?.lastEventType === 'string'
          ? feed.lastEventType.trim()
          : '';
        const eventType = lastEventType || null;
        const shouldFilterByEventType = Boolean(!isInitial && normalizedEventTypes && normalizedEventTypes.size > 0);
        if (
          shouldFilterByEventType
          && !normalizedEventTypes.has(lastEventType.toLowerCase())
        ) {
          hasInitializedRef.current = true;
          return;
        }

        if (typeof callbackRef.current === 'function') {
          callbackRef.current(feed, { initial: isInitial, eventType });
        }
        hasInitializedRef.current = true;
      },
      () => {
        // Keep fail-open behavior: caller still has HTTP/manual refresh fallback.
      },
    );

    return () => {
      hasInitializedRef.current = false;
      lastSignatureRef.current = '';
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [enabled, eventTypeKey, normalizedEventTypes, path]);
};

export default useRealtimePathFeed;
