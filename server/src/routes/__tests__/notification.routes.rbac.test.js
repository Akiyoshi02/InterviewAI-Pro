import { describe, expect, it } from '@jest/globals';
import notificationRoutes from '../notification.routes.js';

const getRouteLayer = (path, method) =>
  notificationRoutes.stack.find(
    (layer) =>
      layer.route
      && layer.route.path === path
      && layer.route.methods?.[method],
  );

const getMiddlewareNames = (path, method) => {
  const layer = getRouteLayer(path, method);
  if (!layer) return [];
  return layer.route.stack.map((entry) => entry.name);
};

describe('Notification routes auth wiring', () => {
  it('requires authentication on all notification endpoints', () => {
    expect(getMiddlewareNames('/', 'get')).toContain('verifyFirebaseAuth');
    expect(getMiddlewareNames('/:id/read', 'patch')).toContain('verifyFirebaseAuth');
    expect(getMiddlewareNames('/read-all', 'patch')).toContain('verifyFirebaseAuth');
    expect(getMiddlewareNames('/:id', 'delete')).toContain('verifyFirebaseAuth');
  });
});
