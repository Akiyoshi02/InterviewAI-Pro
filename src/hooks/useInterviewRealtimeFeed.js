import { useEffect, useMemo, useRef } from 'react';
import { onValue, ref as dbRef } from 'firebase/database';
import { realtimeDb } from '../config/firebase.js';

const buildFeedSignature = (feed = {}) =>
  JSON.stringify(
    Object.entries(feed)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([interviewId, value]) => [
        interviewId,
        value?.lastEventType || '',
        value?.lastEventAt || '',
        value?.status || '',
        value?.updatedAt || '',
      ]),
  );

/**
 * Subscribe to per-user interview realtime feed updates.
 * Calls onFeedUpdate whenever the feed changes.
 */
export const useInterviewRealtimeFeed = ({
  userId,
  enabled = true,
  onFeedUpdate,
}) => {
  const callbackRef = useRef(onFeedUpdate);
  const lastSignatureRef = useRef('');
  const hasInitializedRef = useRef(false);

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
      return undefined;
    }

    const feedRef = dbRef(realtimeDb, feedPath);
    const unsubscribe = onValue(
      feedRef,
      (snapshot) => {
        const feed = snapshot.val() || {};
        const signature = buildFeedSignature(feed);
        if (signature === lastSignatureRef.current) {
          return;
        }
        lastSignatureRef.current = signature;

        if (typeof callbackRef.current === 'function') {
          callbackRef.current(feed, { initial: !hasInitializedRef.current });
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
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [enabled, feedPath]);
};

export default useInterviewRealtimeFeed;
