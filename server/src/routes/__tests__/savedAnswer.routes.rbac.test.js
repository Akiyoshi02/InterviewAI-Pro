import { describe, expect, it } from '@jest/globals';
import savedAnswerRoutes from '../savedAnswer.routes.js';

const getRouteLayer = (path, method) =>
  savedAnswerRoutes.stack.find(
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

describe('Saved answer routes RBAC wiring', () => {
  it('requires candidate role for create/list/update/delete endpoints', () => {
    expect(getMiddlewareNames('/', 'post')).toContain('requireCandidate');
    expect(getMiddlewareNames('/', 'get')).toContain('requireCandidate');
    expect(getMiddlewareNames('/:id', 'patch')).toContain('requireCandidate');
    expect(getMiddlewareNames('/:id', 'delete')).toContain('requireCandidate');
  });
});
