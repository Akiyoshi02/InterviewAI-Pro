import { describe, expect, it } from '@jest/globals';
import gdprRoutes from '../gdpr.routes.js';

const getRouteLayer = (path, method) =>
  gdprRoutes.stack.find(
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

describe('GDPR routes auth wiring', () => {
  it('requires authentication for export and deletion endpoints', () => {
    expect(getMiddlewareNames('/export', 'get')).toContain('verifyFirebaseAuth');
    expect(getMiddlewareNames('/delete', 'post')).toContain('verifyFirebaseAuth');
    expect(getMiddlewareNames('/delete', 'delete')).toContain('verifyFirebaseAuth');
  });

  it('requires authentication for consent fetch endpoint', () => {
    expect(getMiddlewareNames('/consent', 'get')).toContain('verifyFirebaseAuth');
  });
});
