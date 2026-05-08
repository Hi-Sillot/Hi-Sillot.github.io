import { describe, it, expect } from 'vitest'
import { extractFailedUrl } from '../../docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/utils/extract-url'

describe('extractFailedUrl', () => {
  it('extracts URL from Chrome error message', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page-abc123.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page-abc123.js')
  })

  it('extracts URL from Firefox error message', () => {
    const error = new Error('error loading dynamically imported module: https://example.com/assets/chunk-def456.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/chunk-def456.js')
  })

  it('extracts URL from Safari-style error message', () => {
    const error = new Error('Importing a module script failed. https://example.com/assets/page.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page.js')
  })

  it('extracts relative URL from error message', () => {
    const error = new Error('Failed to fetch dynamically imported module: ./assets/page-abc123.js')
    expect(extractFailedUrl(error)).toBe('./assets/page-abc123.js')
  })

  it('returns null for unrelated error', () => {
    const error = new Error('Some other error')
    expect(extractFailedUrl(error)).toBeNull()
  })

  it('returns null for Safari error without URL', () => {
    const error = new Error('Importing a module script failed.')
    expect(extractFailedUrl(error)).toBeNull()
  })

  it('handles error with extra whitespace', () => {
    const error = new Error('Failed to fetch dynamically imported module:   https://example.com/assets/page.js   ')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page.js')
  })
})
