const { evaluateRisk, applyPolicy } = require('../src/services/playIntegrityService')

describe('evaluateRisk', () => {
  it('nível low e sem flags quando app reconhecido, dispositivo íntegro e licenciado', () => {
    const risk = evaluateRisk('PLAY_RECOGNIZED', ['MEETS_STRONG_INTEGRITY'], 'LICENSED')
    expect(risk).toEqual({ level: 'low', flags: [] })
  })

  it('marca APP_NOT_RECOGNIZED e sobe para high quando o app não é reconhecido', () => {
    const risk = evaluateRisk('UNRECOGNIZED', ['MEETS_STRONG_INTEGRITY'], 'LICENSED')
    expect(risk).toEqual({ level: 'high', flags: ['APP_NOT_RECOGNIZED'] })
  })

  it('marca DEVICE_NOT_TRUSTED e sobe para high quando nenhum veredito de integridade bate', () => {
    const risk = evaluateRisk('PLAY_RECOGNIZED', [], 'LICENSED')
    expect(risk).toEqual({ level: 'high', flags: ['DEVICE_NOT_TRUSTED'] })
  })

  it('marca UNLICENSED_APP e sobe para medium quando só a licença falha', () => {
    const risk = evaluateRisk('PLAY_RECOGNIZED', ['MEETS_BASIC_INTEGRITY'], 'UNLICENSED')
    expect(risk).toEqual({ level: 'medium', flags: ['UNLICENSED_APP'] })
  })
})

describe('applyPolicy', () => {
  it('permite quando tudo valida, independente do enforcement', () => {
    const result = applyPolicy({
      appVerdict: 'PLAY_RECOGNIZED',
      deviceVerdicts: ['MEETS_DEVICE_INTEGRITY'],
      licenseVerdict: 'LICENSED',
      action: 'app_startup',
      enforcement: 'monitor',
    })
    expect(result).toEqual({ allowed: true, reason: 'validated' })
  })

  it('bloqueia app não reconhecido quando enforcement é enforce', () => {
    const result = applyPolicy({
      appVerdict: 'UNRECOGNIZED',
      deviceVerdicts: ['MEETS_DEVICE_INTEGRITY'],
      licenseVerdict: 'LICENSED',
      action: 'app_startup',
      enforcement: 'enforce',
    })
    expect(result).toEqual({ allowed: false, reason: 'app_not_recognized' })
  })

  it('só avisa (não bloqueia) app não reconhecido quando enforcement é monitor', () => {
    const result = applyPolicy({
      appVerdict: 'UNRECOGNIZED',
      deviceVerdicts: ['MEETS_DEVICE_INTEGRITY'],
      licenseVerdict: 'LICENSED',
      action: 'app_startup',
      enforcement: 'monitor',
    })
    expect(result).toEqual({ allowed: true, reason: 'app_not_recognized' })
  })

  it('bloqueia sem enforcement explícito quando a action está em ENFORCE_ACTIONS', () => {
    const result = applyPolicy({
      appVerdict: 'UNRECOGNIZED',
      deviceVerdicts: ['MEETS_DEVICE_INTEGRITY'],
      licenseVerdict: 'LICENSED',
      action: 'device_activation',
      enforcement: 'monitor',
    })
    expect(result).toEqual({ allowed: false, reason: 'app_not_recognized' })
  })

  it('bloqueia dispositivo não confiável quando enforcement é enforce', () => {
    const result = applyPolicy({
      appVerdict: 'PLAY_RECOGNIZED',
      deviceVerdicts: [],
      licenseVerdict: 'LICENSED',
      action: 'app_startup',
      enforcement: 'enforce',
    })
    expect(result).toEqual({ allowed: false, reason: 'device_integrity_failed' })
  })

  it('bloqueia app sem licença quando enforcement é enforce', () => {
    const result = applyPolicy({
      appVerdict: 'PLAY_RECOGNIZED',
      deviceVerdicts: ['MEETS_DEVICE_INTEGRITY'],
      licenseVerdict: 'UNLICENSED',
      action: 'app_startup',
      enforcement: 'enforce',
    })
    expect(result).toEqual({ allowed: false, reason: 'unlicensed' })
  })

  it('permite app sem licença quando enforcement é monitor', () => {
    const result = applyPolicy({
      appVerdict: 'PLAY_RECOGNIZED',
      deviceVerdicts: ['MEETS_DEVICE_INTEGRITY'],
      licenseVerdict: 'UNLICENSED',
      action: 'app_startup',
      enforcement: 'monitor',
    })
    expect(result).toEqual({ allowed: true, reason: 'validated' })
  })
})
