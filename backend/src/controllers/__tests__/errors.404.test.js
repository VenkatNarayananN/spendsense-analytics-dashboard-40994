const request = require('supertest');
const app = require('../../app');

describe('Centralized error handling - 404', () => {
  test('unknown route returns consistent JSON error shape', async () => {
    const res = await request(app).get('/definitely-not-a-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error).toHaveProperty('message');
    expect(res.body.error).toHaveProperty('details');
    expect(res.body.error.details).toMatchObject({
      method: 'GET',
      path: '/definitely-not-a-route',
    });
  });
});
