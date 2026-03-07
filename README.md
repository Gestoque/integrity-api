# Integrity API

API REST Node.js para validar tokens Play Integrity enviados por apps mobile. Projetada para SaaS, clean code, arquitetura robusta e pronta para deploy no Vercel ou Azure.

## Funcionalidades
- Endpoint seguro: `POST /validate-integrity-token`
- Valida tokens Play Integrity usando conta de serviço Google
- Retorna status de integridade e detalhes
- Loga requisições e resultados (winston)
- Estrutura modular, escalável e fácil de manter
- Usa `.env` para configs sensíveis
- Testes automatizados (unitários e integração)
- Princípios de clean code (SOLID, tratamento de erros, middlewares)
- Pode ser usada por múltiplos apps mobile

## Estrutura do Projeto
```
src/
  routes/integrity.js
  controllers/integrityController.js
  services/playIntegrityService.js
  middlewares/auth.js
  utils/logger.js
  config/index.js
  app.js
package.json
README.md
.env
.gitignore
keys/
tests/
```

## Uso
1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure o `.env` com o caminho do arquivo da conta de serviço Google:
   - `GOOGLE_SERVICE_ACCOUNT_KEY_PATH=keys/g-collector-b221146d92e1.json`
4. Inicie a API localmente: `npm start`
5. Execute os testes: `npm test`

## Deploy
### GitHub
- Crie o repositório e suba o projeto:
  ```
  git init
  git remote add origin https://github.com/Gestoque/integrity-api.git
  git add .
  git commit -m "Primeiro commit"
  git push -u origin master
  ```

### Vercel
- Instale o Vercel CLI: `npm install -g vercel`
- Rode `vercel` no diretório do projeto e siga as instruções
- Configure as variáveis de ambiente no painel da Vercel
- O deploy será automático e você receberá uma URL pública

## Variáveis de Ambiente
- `.env` deve conter:
  - `GOOGLE_SERVICE_ACCOUNT_KEY_PATH=keys/g-collector-b221146d92e1.json`

## Licença
MIT
