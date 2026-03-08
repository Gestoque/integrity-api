# GCollector Play Integrity API

API REST Node.js para validação de tokens [Google Play Integrity](https://developer.android.com/google/play/integrity) do app GCollector. Projetada para SaaS, seguindo clean code, OpenAPI 3.1 e boas práticas de segurança.

- **Produção:** `https://play-integrity.gestoque.com.br`
- **Spec:** OpenAPI 3.1.0
- **App:** `br.com.gestoque.app.gcollector`

---

## Funcionalidades

- `POST /validate-integrity-token` — valida tokens Play Integrity
- `GET /health` — health check
- Validação completa de schema com todos os campos obrigatórios
- Anti-replay de nonce (TTL 5 min, in-memory)
- Avaliação de risco (`low / medium / high`) com flags
- Política de enforcement por action (`enforce` vs `monitor`)
- Suporte a payload legado (`token`)
- Rate limit: 30 req/IP/min
- CORS configurável via `ALLOWED_ORIGINS`
- Logs estruturados com winston
- Respostas padronizadas conforme contrato OpenAPI

---

## Contrato da API

### `POST /validate-integrity-token`

#### Request Body (todos os campos obrigatórios exceto `token`, `deviceId`, `appVersion`, `buildNumber`)

```json
{
  "integrityToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "nonceIssuedAt": "2026-03-07T14:22:31.000Z",
  "clientTimestamp": "2026-03-07T14:22:32.000Z",
  "action": "data_sync",
  "enforcement": "enforce",
  "platform": "android",
  "packageName": "br.com.gestoque.app.gcollector",
  "appVersion": "1.0.0",
  "buildNumber": "100"
}
```

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `integrityToken` | string | ✅ | minLength: 20 |
| `nonce` | string | ✅ | minLength: 16, único por requisição |
| `nonceIssuedAt` | string (ISO-8601) | ✅ | janela máx 5 min |
| `clientTimestamp` | string (ISO-8601) | ✅ | |
| `action` | string | ✅ | `app_startup` \| `device_activation` \| `data_sync` |
| `enforcement` | string | ✅ | `monitor` \| `enforce` |
| `platform` | string | ✅ | `android` |
| `packageName` | string | ✅ | `br.com.gestoque.app.gcollector` |
| `token` | string | ❌ | compatibilidade legado |
| `deviceId` | string | ❌ | |
| `appVersion` | string | ❌ | |
| `buildNumber` | string | ❌ | |

#### Response 200 — `IntegrityValidationResponse`

```json
{
  "allowed": true,
  "decision": "allow",
  "reason": "validated",
  "requestId": "f25b8e7d-3be7-45f2-97e2-5c6f8ea28d53",
  "validatedAt": "2026-03-07T14:22:33.000Z",
  "enforcement": "enforce",
  "action": "data_sync",
  "verdicts": {
    "appRecognitionVerdict": "PLAY_RECOGNIZED",
    "deviceRecognitionVerdict": ["MEETS_DEVICE_INTEGRITY"],
    "appLicensingVerdict": "LICENSED"
  },
  "risk": {
    "level": "low",
    "flags": []
  },
  "nonce": {
    "accepted": true,
    "replayDetected": false,
    "expiresAt": "2026-03-07T14:27:31.000Z"
  }
}
```

#### Respostas de erro — `ErrorResponse`

```json
{
  "code": "INVALID_PAYLOAD",
  "message": "nonce é obrigatório e deve ter ao menos 16 caracteres",
  "requestId": null,
  "timestamp": "2026-03-07T14:22:33.000Z"
}
```

| HTTP | `code` | Causa |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | Campo ausente ou inválido |
| 409 | `NONCE_REPLAY` | Nonce já utilizado |
| 409 | `NONCE_EXPIRED` | `nonceIssuedAt` fora da janela de 5 min |
| 422 | `TOKEN_INVALID` | Token não decodificável pelo Google |
| 429 | `RATE_LIMITED` | Limite de 30 req/IP/min excedido |
| 500 | `INTERNAL_ERROR` | Erro interno inesperado |
| 502 | `PROVIDER_ERROR` | Falha ao consultar API do Google |

---

## Estrutura do Projeto

```
src/
  app.js                         # Express, CORS, rate limit, rotas
  routes/integrity.js            # POST /validate-integrity-token
  controllers/integrityController.js  # Camada HTTP
  services/playIntegrityService.js    # Lógica de validação e política
  utils/
    validator.js                 # Validação de schema do request
    nonceStore.js                # Anti-replay (TTL 5 min)
    logger.js                    # Winston logger
  config/index.js                # Variáveis de ambiente
  middlewares/auth.js            # Placeholder
tests/
  integrity.test.js              # 15 testes (Jest + supertest)
keys/                            # Chave de conta de serviço (não versionada)
```

---

## Instalação e Uso Local

```bash
# 1. Instale as dependências
npm install

# 2. Configure o .env
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=keys/g-collector-b221146d92e1.json

# 3. Coloque a chave JSON em keys/
# (excluída do git via .gitignore)

# 4. Inicie localmente
npm start

# 5. Execute os testes
npm test
```

---

## Deploy

O projeto faz deploy automático no **Vercel** a cada `git push` no branch `master`.

### Variáveis de ambiente no Vercel

| Variável | Descrição |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | JSON completo da conta de serviço (em vez do arquivo) |
| `ALLOWED_ORIGINS` | Origens CORS permitidas (padrão: `*`) |

### Atualizar produção

```bash
git add .
git commit -m "feat: descrição"
git push origin master
```

---

## Testes

```bash
npm test
```

15 cenários cobertos:
- Validação de todos os campos obrigatórios (400)
- Validação de `minLength` de `integrityToken` e `nonce`
- 200 com `IntegrityValidationResponse` completo
- Anti-replay de nonce (409)
- Payload legado (`token`)
- Token inválido retorna `ErrorResponse` (422/502)

---

## Licença

MIT

