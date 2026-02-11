import { useEffect, useRef } from 'react';
import { onValue, ref as dbRef } from 'firebase/database';
import { realtimeDb } from '../config/firebase.js';

const buildFeedSignature = (feed = {}) => (
  `${feed?.lastEventId || ''}|${feed?.lastEventType || ''}|${feed?.lastEventAt || ''}|${feed?.updatedAt || ''}`
);

/**
 * Generic RTDB feed listener for paths that expose a single feed object.
 */
export const useRealtimePathFeed = ({
  path,
  enabled = true,
  onFeedUpdate,
}) => {
  const callbackRef = useRef(onFeedUpdate);
  const lastSignatureRef = useRef('');
  const hasInitializedRef = useRef(false);

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
        if (typeof callbackRef.current === 'function') {
          callbackRef.current(feed, { initial: !hasInitializedRef.current });
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
  }, [enabled, path]);
};

export default useRealtimePathFeed;
