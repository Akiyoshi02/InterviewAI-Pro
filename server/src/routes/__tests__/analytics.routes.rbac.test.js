import { describe, expect, it } from '@jest/globals';
import analyticsRoutes from '../analytics.routes.js';

const getRouteLayer = (path, method) =>
  analyticsRoutes.stack.find(
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

describe('Analytics routes RBAC wiring', () => {
  it('protects candidate dashboard metrics endpoint with requireCandidate', () => {
    const middlewareNames = getMiddlewareNames('/candidate/dashboard-metrics', 'get');
    expect(middlewareNames).toContain('requireCandidate');
  });

  it('protects candidate historical endpoint with requireCandidate', () => {
    const middlewareNames = getMiddlewareNames('/candidate/historical', 'get');
    expect(middlewareNames).toContain('requireCandidate');
  });

  it('protects candidate full analytics endpoint with requireCandidate', () => {
    const middlewareNames = getMiddlewareNames('/candidate/full', 'get');
    expect(middlewareNames).toContain('requireCandidate');
  });
});
