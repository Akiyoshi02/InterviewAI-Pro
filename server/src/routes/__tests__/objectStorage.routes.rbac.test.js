import { describe, expect, it } from '@jest/globals';
import objectStorageRoutes from '../objectStorage.routes.js';

const getRouteLayer = (path, method) =>
  objectStorageRoutes.stack.find(
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

describe('Object storage route auth wiring', () => {
  it('requires authentication for signed-url generation', () => {
    const middlewareNames = getMiddlewareNames('/signed-url', 'get');
    expect(middlewareNames).toContain('verifyFirebaseAuth');
  });

  it('keeps signed download endpoint separate from auth middleware', () => {
    const middlewareNames = getMiddlewareNames('/download', 'get');
    expect(middlewareNames).not.toContain('verifyFirebaseAuth');
  });
});
