import { describe, expect, it } from '@jest/globals';
import referralRoutes from '../referral.routes.js';

const getRouteLayer = (path, method) =>
  referralRoutes.stack.find(
    (layer) => layer.route
      && layer.route.path === path
      && layer.route.methods?.[method],
  );

const getMiddlewareNames = (path, method) => {
  const layer = getRouteLayer(path, method);
  if (!layer) return [];
  return layer.route.stack.map((entry) => entry.name);
};

describe('Referral routes RBAC wiring', () => {
  it('protects GET /me with candidate-only middleware', () => {
    const middlewareNames = getMiddlewareNames('/me', 'get');
    expect(middlewareNames).toContain('requireCandidate');
  });

  it('protects POST /attribute with system-admin middleware', () => {
    const middlewareNames = getMiddlewareNames('/attribute', 'post');
    expect(middlewareNames).toContain('requireSystemAdmin');
  });

  it('protects POST /first-interview with system-admin middleware', () => {
    const middlewareNames = getMiddlewareNames('/first-interview', 'post');
    expect(middlewareNames).toContain('requireSystemAdmin');
  });
});
