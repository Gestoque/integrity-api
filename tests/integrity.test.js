const request = require('supertest');
const app = require('../src/app');

describe('POST /validate-integrity-token', () => {
  it('deve retornar inválido se token não fornecido', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('inválido');
  });

  it('deve retornar válido para token mock', async () => {
    const res = await request(app)
      .post('/validate-integrity-token')
      .send({ token: 'valid-token' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('válido');
  });
});

// Tests for Play Integrity token validation will be implemented here.
