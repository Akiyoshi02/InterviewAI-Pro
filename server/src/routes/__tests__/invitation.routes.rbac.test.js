import { describe, expect, it } from '@jest/globals';
import invitationRoutes from '../invitation.routes.js';

const getRouteLayer = (path, method) =>
  invitationRoutes.stack.find(
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

describe('Invitation routes RBAC wiring', () => {
  it('protects invitation acceptance with requireCandidate', () => {
    const middlewareNames = getMiddlewareNames('/accept', 'post');
    expect(middlewareNames).toContain('requireCandidate');
  });

  it('does not expose invitation acceptance as public endpoint', () => {
    const middlewareNames = getMiddlewareNames('/accept', 'post');
    expect(middlewareNames).toContain('verifyFirebaseAuth');
  });
});
