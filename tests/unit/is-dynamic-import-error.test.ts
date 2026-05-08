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

  it('detects error with mixed case', () => {
    const error = new Error('FAILED TO FETCH DYNAMICALLY IMPORTED MODULE: test')
    expect(isDynamicImportError(error)).toBe(true)
  })

  it('returns false for TypeError without dynamic import', () => {
    const error = new TypeError('Cannot read properties of undefined')
    expect(isDynamicImportError(error)).toBe(false)
  })

  it('returns false for empty error message', () => {
    const error = new Error('')
    expect(isDynamicImportError(error)).toBe(false)
  })

  it('detects partial match in longer message', () => {
    const error = new Error('Error: Failed to fetch dynamically imported module: chunk.js at VueRouter')
    expect(isDynamicImportError(error)).toBe(true)
  })

  it('returns false for similar but different error', () => {
    const error = new Error('Failed to fetch data from API')
    expect(isDynamicImportError(error)).toBe(false)
  })

  it('detects "couldn\'t resolve component" with different casing', () => {
    const error = new Error("COULDN'T RESOLVE COMPONENT at /page")
    expect(isDynamicImportError(error)).toBe(true)
  })

  it('handles error with only whitespace', () => {
    const error = new Error('   ')
    expect(isDynamicImportError(error)).toBe(false)
  })

  it('returns false for generic import error', () => {
    const error = new Error('Cannot find module ./foo')
    expect(isDynamicImportError(error)).toBe(false)
  })
})
