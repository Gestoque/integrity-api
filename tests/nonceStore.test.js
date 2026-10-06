const { checkAndRegister, NONCE_TTL_MS } = require('../src/utils/nonceStore')

describe('checkAndRegister', () => {
  it('aceita um nonce novo e válido', () => {
    const result = checkAndRegister(`nonce-${Date.now()}-${Math.random()}`)
    expect(result.valid).toBe(true)
    expect(result.replayDetected).toBe(false)
    expect(result.expiresAt).toBeTruthy()
  })

  it('detecta replay ao reusar o mesmo nonce', () => {
    const nonce = `nonce-replay-${Date.now()}-${Math.random()}`
    checkAndRegister(nonce)
    const result = checkAndRegister(nonce)

    expect(result.valid).toBe(false)
    expect(result.replayDetected).toBe(true)
    expect(result.reason).toBe('nonce_replay')
  })

  it('rejeita nonce vazio, undefined ou null', () => {
    expect(checkAndRegister('').valid).toBe(false)
    expect(checkAndRegister(undefined).valid).toBe(false)
    expect(checkAndRegister(null).valid).toBe(false)
  })

  it('rejeita nonce que não é string', () => {
    expect(checkAndRegister(12345678901).valid).toBe(false)
  })

  it('rejeita nonce menor que 8 caracteres', () => {
    const result = checkAndRegister('short12')
    expect(result.valid).toBe(false)
    expect(result.replayDetected).toBe(false)
  })

  it('aceita nonce com exatamente 8 caracteres', () => {
    const result = checkAndRegister(`e${Date.now()}`.slice(0, 8))
    expect(result.valid).toBe(true)
  })
})

describe('checkAndRegister — expiração (TTL)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('ainda detecta replay logo após o TTL expirar, antes da limpeza periódica rodar', () => {
    // checkAndRegister só olha se a chave está no Map — quem de fato expira
    // a entrada é o setInterval de limpeza (a cada 60s), não esta função.
    // Então um nonce "expirado" mas ainda não limpo continua contando
    // como replay.
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const nonce = `nonce-ttl-${Math.random()}`
    checkAndRegister(nonce)

    jest.setSystemTime(new Date(Date.now() + NONCE_TTL_MS + 1))
    const result = checkAndRegister(nonce)

    expect(result.valid).toBe(false)
    expect(result.replayDetected).toBe(true)
  })
})

describe('checkAndRegister — limpeza periódica', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('libera o nonce para reuso depois que a limpeza periódica roda', () => {
    // O setInterval de limpeza é criado quando o módulo é carregado — para
    // o fake timer conseguir controlar esse interval, o require precisa
    // acontecer DEPOIS de jest.useFakeTimers() (e com módulo isolado, para
    // não reaproveitar a instância já carregada no topo deste arquivo).
    jest.useFakeTimers()
    jest.resetModules()
    const fresh = require('../src/utils/nonceStore')

    const nonce = `nonce-cleanup-${Math.random()}`
    fresh.checkAndRegister(nonce)

    jest.advanceTimersByTime(fresh.NONCE_TTL_MS + 60 * 1000)

    const result = fresh.checkAndRegister(nonce)
    expect(result.valid).toBe(true)
    expect(result.replayDetected).toBe(false)
  })
})
