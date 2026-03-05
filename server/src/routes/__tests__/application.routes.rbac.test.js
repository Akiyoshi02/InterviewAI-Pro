import { describe, expect, it } from '@jest/globals';
import applicationRoutes from '../application.routes.js';

const getRouteLayer = (path, method) =>
  applicationRoutes.stack.find(
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

describe('Application routes RBAC wiring', () => {
  it('protects candidate apply endpoint with requireCandidate', () => {
    const middlewareNames = getMiddlewareNames('/jobs/:jobId/apply', 'post');
    expect(middlewareNames).toContain('requireCandidate');
  });

  it('protects candidate list endpoint with requireCandidate', () => {
    const middlewareNames = getMiddlewareNames('/candidates/applications', 'get');
    expect(middlewareNames).toContain('requireCandidate');
  });

  it('protects withdraw endpoint with requireCandidate', () => {
    const middlewareNames = getMiddlewareNames('/applications/:id', 'delete');
    expect(middlewareNames).toContain('requireCandidate');
  });

  it('protects recruiter job-applications endpoint with org role/approval middleware', () => {
    const middlewareNames = getMiddlewareNames('/jobs/:jobId/applications', 'get');
    expect(middlewareNames).toContain('requireApprovedOrganization');
    expect(middlewareNames).not.toContain('requireCandidate');
  });
});
