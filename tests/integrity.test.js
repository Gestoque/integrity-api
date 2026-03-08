const request = require('supertest');
const app = require('../src/app');

const MOCK_TOKEN = 'valid-mock-token-testing'; // 24 chars, passes minLength:20

const validPayload = (overrides = {}) => ({
  integrityToken: MOCK_TOKEN,
  nonce: `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  nonceIssuedAt: new Date().toISOString(),
  clientTimestamp: new Date().toISOString(),
  action: 'app_startup',
  enforcement: 'monitor',
  platform: 'android',
  packageName: 'br.com.gestoque.app.gcollector',
  ...overrides
});

describe('POST /validate-integrity-token', () => {

  // ── Schema 400 ─────────────────────────────────────────────────────────────

  it('400 se integrityToken ausente', async () => {
    const { integrityToken, ...withoutToken } = validPayload();
    const res = await request(app).post('/validate-integrity-token').send(withoutToken);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('400 se integrityToken menor que 20 caracteres', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload({ integrityToken: 'tooshort' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se nonce ausente', async () => {
    const { nonce, ...withoutNonce } = validPayload();
    const res = await request(app).post('/validate-integrity-token').send(withoutNonce);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se nonce menor que 16 caracteres', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload({ nonce: 'short123' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se action inválida', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload({ action: 'invalid_action' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se platform ausente', async () => {
    const { platform, ...withoutPlatform } = validPayload();
    const res = await request(app).post('/validate-integrity-token').send(withoutPlatform);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se platform não é android', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload({ platform: 'ios' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se packageName ausente', async () => {
    const { packageName, ...withoutPkg } = validPayload();
    const res = await request(app).post('/validate-integrity-token').send(withoutPkg);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se packageName incorreto', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload({ packageName: 'com.outro.app' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se nonceIssuedAt ausente', async () => {
    const { nonceIssuedAt, ...withoutIssuedAt } = validPayload();
    const res = await request(app).post('/validate-integrity-token').send(withoutIssuedAt);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  it('400 se clientTimestamp ausente', async () => {
    const { clientTimestamp, ...withoutTs } = validPayload();
    const res = await request(app).post('/validate-integrity-token').send(withoutTs);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYLOAD');
  });

  // ── 200 sucesso ────────────────────────────────────────────────────────────

  it('200 com IntegrityValidationResponse para token mock válido', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload());
    expect(res.statusCode).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body.decision).toBe('allow');
    expect(res.body.reason).toBe('validated');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('validatedAt');
    expect(res.body).toHaveProperty('enforcement');
    expect(res.body).toHaveProperty('action');
    expect(res.body.verdicts).toHaveProperty('appRecognitionVerdict');
    expect(res.body.verdicts).toHaveProperty('deviceRecognitionVerdict');
    expect(res.body.verdicts).toHaveProperty('appLicensingVerdict');
    expect(res.body.risk).toHaveProperty('level');
    expect(res.body.risk).toHaveProperty('flags');
    expect(res.body.nonce.accepted).toBe(true);
    expect(res.body.nonce.replayDetected).toBe(false);
    expect(res.body.nonce).toHaveProperty('expiresAt');
  });

  // ── 409 nonce replay ───────────────────────────────────────────────────────

  it('409 com ErrorResponse para nonce replay', async () => {
    const nonce = `nonce-replay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await request(app).post('/validate-integrity-token').send(validPayload({ nonce }));
    const res = await request(app).post('/validate-integrity-token').send(validPayload({ nonce }));
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('NONCE_REPLAY');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('timestamp');
  });

  // ── Payload legado ─────────────────────────────────────────────────────────

  it('200 com suporte legado (token + integrityToken)', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload({ token: MOCK_TOKEN }));
    expect(res.statusCode).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  // ── Erro externo (token real inválido) ────────────────────────────────────

  it('retorna ErrorResponse para token inválido (422 ou 502)', async () => {
    const res = await request(app).post('/validate-integrity-token')
      .send(validPayload({ integrityToken: 'invalid-real-token-12345' }));
    expect([422, 502]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('timestamp');
  });
});

