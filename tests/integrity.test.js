const request = require('supertest');
const app = require('../src/app');

const validPayload = (overrides = {}) => ({
  integrityToken: 'valid-token',
  nonce: `nonce-${Date.now()}-${Math.random()}`,
  nonceIssuedAt: new Date().toISOString(),
  clientTimestamp: new Date().toISOString(),
  action: 'app_startup',
  enforcement: 'monitor',
  platform: 'android',
  packageName: 'br.com.gestoque.app.gcollector',
  ...overrides
});

describe('POST /validate-integrity-token', () => {
  it('deve retornar 400 se integrityToken não fornecido', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({ nonce: 'nonce12345678', action: 'app_startup', enforcement: 'monitor' });
    expect(res.statusCode).toBe(400);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toBe('invalid_payload');
    expect(res.body).toHaveProperty('validatedAt');
  });

  it('deve retornar 400 se nonce não fornecido', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({ integrityToken: 'valid-token', action: 'app_startup', enforcement: 'monitor' });
    expect(res.statusCode).toBe(400);
    expect(res.body.reason).toBe('invalid_payload');
  });

  it('deve retornar 400 se action inválida', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send(validPayload({ action: 'invalid_action' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.reason).toBe('invalid_payload');
  });

  it('deve retornar 400 se platform incorreto', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send(validPayload({ platform: 'ios' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.reason).toBe('invalid_payload');
  });

  it('deve retornar 400 se packageName incorreto', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send(validPayload({ packageName: 'com.outro.app' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.reason).toBe('invalid_payload');
  });

  it('deve retornar 200 com allowed=true para token mock válido', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send(validPayload());
    expect(res.statusCode).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body.decision).toBe('allow');
    expect(res.body.reason).toBe('validated');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('validatedAt');
    expect(res.body).toHaveProperty('verdicts');
    expect(res.body).toHaveProperty('risk');
    expect(res.body.nonce.accepted).toBe(true);
    expect(res.body.nonce.replayDetected).toBe(false);
  });

  it('deve rejeitar replay de nonce com HTTP 409', async () => {
    const nonce = `nonce-replay-${Date.now()}`;
    await request(app).post('/validate-integrity-token').send(validPayload({ nonce }));
    const res = await request(app).post('/validate-integrity-token').send(validPayload({ nonce }));
    expect(res.statusCode).toBe(409);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toBe('nonce_replay');
    expect(res.body.nonce.replayDetected).toBe(true);
  });

  it('deve suportar payload legado (token)', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({ token: 'valid-token', nonce: `nonce-legacy-${Date.now()}`, action: 'app_startup', enforcement: 'monitor' });
    expect(res.statusCode).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('deve retornar campos obrigatórios mesmo em erro', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send(validPayload({ integrityToken: 'invalid-real-token' }));
    expect(res.body).toHaveProperty('allowed');
    expect(res.body).toHaveProperty('decision');
    expect(res.body).toHaveProperty('reason');
    expect(res.body).toHaveProperty('verdicts');
    expect(res.body).toHaveProperty('risk');
    expect(res.body).toHaveProperty('nonce');
    expect(res.body).toHaveProperty('validatedAt');
    expect(res.body).toHaveProperty('enforcement');
    expect(res.body).toHaveProperty('action');
  });
});
