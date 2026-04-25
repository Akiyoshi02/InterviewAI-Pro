import express from 'express';
import { setupSecurity } from '../security.middleware.js';

const startTestServer = async () => {
  const app = express();
  app.use(express.json());
  setupSecurity(app);

  app.get('/api/auth/me', (_req, res) => {
    res.json({ success: true });
  });

  app.post('/api/auth/register', (_req, res) => {
    res.json({ success: true });
  });

  await new Promise((resolve) => {
    const server = app.listen(0, () => resolve());
    app.locals.server = server;
  });

  const { port } = app.locals.server.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise((resolve, reject) => {
        app.locals.server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
};

describe('setupSecurity', () => {
  let server;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('does not rate limit /api/auth/me during repeated session hydration', async () => {
    const responses = [];

    for (let index = 0; index < 120; index += 1) {
      // Use a stable client fingerprint to mirror browser session checks.
      // If authLimiter or the generic API limiter were still applied here,
      // repeated SPA session checks would start returning 429 and break navigation.
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(`${server.baseUrl}/api/auth/me`, {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });
      responses.push(response.status);
    }

    expect(responses).toEqual(new Array(120).fill(200));
  });

  it('keeps registration endpoints rate limited', async () => {
    const responses = [];

    for (let index = 0; index < 6; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(`${server.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
        body: JSON.stringify({ index }),
      });
      responses.push(response.status);
    }

    expect(responses.slice(0, 5)).toEqual(new Array(5).fill(200));
    expect(responses[5]).toBe(429);
  });

  it('allows X-Meeting-Token in CORS preflight requests', async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:4028',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,x-meeting-token',
      },
    });

    expect(response.status).toBe(204);
    const allowedHeaders = response.headers.get('access-control-allow-headers') || '';
    expect(allowedHeaders.toLowerCase()).toContain('x-meeting-token');
  });

  it('allows the 127.0.0.1 frontend alias during local development', async () => {
    const origin = 'http://127.0.0.1:4028';
    const response = await fetch(`${server.baseUrl}/api/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });
});
