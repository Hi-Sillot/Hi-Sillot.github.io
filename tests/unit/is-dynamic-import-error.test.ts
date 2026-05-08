import { describe, it, expect } from 'vitest'
import { isDynamicImportError } from '../../docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/utils/is-dynamic-import-error'

describe('isDynamicImportError', () => {
  it('detects Chrome dynamic import error', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js')
    expect(isDynamicImportError(error)).toBe(true)
  })

  it('detects Firefox dynamic import error', () => {
    const error = new Error('error loading dynamically imported module: https://example.com/assets/page.js')
    expect(isDynamicImportError(error)).toBe(true)
  })

  it('detects Safari dynamic import error', () => {
    const error = new Error('Importing a module script failed.')
    expect(isDynamicImportError(error)).toBe(true)
  })

  it('detects component resolution error', () => {
    const error = new Error("Couldn't resolve component at /page")
    expect(isDynamicImportError(error)).toBe(true)
  })

  it('returns false for unrelated error', () => {
    const error = new Error('Network request failed')
    expect(isDynamicImportError(error)).toBe(false)
  })

  it('returns false for syntax error', () => {
    const error = new Error('Unexpected token')
    expect(isDynamicImportError(error)).toBe(false)
  })

  it('is case insensitive for Firefox error', () => {
    const error = new Error('Error loading dynamically imported module: https://example.com/assets/page.js')
    expect(isDynamicImportError(error)).toBe(true)
  })
})
