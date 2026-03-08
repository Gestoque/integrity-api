const request = require('supertest');
const app = require('../src/app');

describe('POST /validate-integrity-token', () => {
  it('deve retornar 403 se token não fornecido', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({});
    expect(res.statusCode).toBe(403);
    expect(res.body.allowed).toBe(false);
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('deve retornar 200 para token mock válido', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({ integrityToken: 'valid-token', nonce: `nonce-${Date.now()}`, action: 'app_startup' });
    expect(res.statusCode).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('verdicts');
  });

  it('deve rejeitar replay de nonce', async () => {
    const nonce = `nonce-replay-${Date.now()}`;
    await request(app)
      .post('/validate-integrity-token')
      .send({ integrityToken: 'valid-token', nonce, action: 'app_startup' });
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({ integrityToken: 'valid-token', nonce, action: 'app_startup' });
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toMatch(/replay|reutilizado/i);
  });

  it('deve suportar payload legado (token)', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({ token: 'valid-token' });
    expect(res.statusCode).toBe(200);
    expect(res.body.allowed).toBe(true);
  });
});

// Tests for Play Integrity token validation will be implemented here.
