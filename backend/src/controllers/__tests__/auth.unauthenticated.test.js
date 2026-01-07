const request = require('supertest');
const app = require('../../app');

describe('Unauthenticated access behavior', () => {
  test('GET /api/fx/latest without Authorization returns 401 with standardized error JSON', async () => {
    const res = await request(app).get('/api/fx/latest?base=USD');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    expect(res.body.error).toHaveProperty('message', 'Authentication required');
  });

  test('GET /api/health does not require Authorization (200)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: 'backend' });
  });

  test('POST /api/demo/seed without Authorization returns 401', async () => {
    const res = await request(app).post('/api/demo/seed').send({ count: 10 });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
  });
});
