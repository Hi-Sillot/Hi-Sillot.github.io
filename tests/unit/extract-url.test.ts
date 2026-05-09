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

  it('extracts URL with query parameters', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js?v=abc')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page.js?v=abc')
  })

  it('extracts URL with hash in path', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page-Ci2ncBUL.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page-Ci2ncBUL.js')
  })

  it('handles multiline error message', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js\nSome additional info')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page.js')
  })

  it('handles URL with port number', () => {
    const error = new Error('Failed to fetch dynamically imported module: http://localhost:8080/assets/chunk-abc.js')
    expect(extractFailedUrl(error)).toBe('http://localhost:8080/assets/chunk-abc.js')
  })

  it('extracts URL with multiple query parameters', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js?v=abc&t=123')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page.js?v=abc&t=123')
  })

  it('extracts URL with hash fragment', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js#section')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page.js#section')
  })

  it('handles URL with underscore and dash', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/chunk-abc_def-123.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/chunk-abc_def-123.js')
  })

  it('extracts URL from Firefox error with mixed case', () => {
    const error = new Error('Error loading dynamically imported module: https://example.com/assets/page.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/page.js')
  })

  it('handles relative path starting with /', () => {
    const error = new Error('Failed to fetch dynamically imported module: /assets/page-abc123.js')
    expect(extractFailedUrl(error)).toBe('/assets/page-abc123.js')
  })

  it('returns null for empty error message', () => {
    const error = new Error('')
    expect(extractFailedUrl(error)).toBeNull()
  })

  it('handles URL with special characters in path', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/页面-abc.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/页面-abc.js')
  })

  it('extracts URL with URL-encoded Chinese characters', () => {
    const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/git%20tag%20%E5%92%8C%20branch%20%E7%9A%84%E5%8C%BA%E5%88%AB%E4%BB%A5%E5%8F%8A%E4%BD%BF%E7%94%A8%E5%9C%BA%E6%99%AF-DjchU1y6.js')
    expect(extractFailedUrl(error)).toBe('https://example.com/assets/git%20tag%20%E5%92%8C%20branch%20%E7%9A%84%E5%8C%BA%E5%88%AB%E4%BB%A5%E5%8F%8A%E4%BD%BF%E7%94%A8%E5%9C%BA%E6%99%AF-DjchU1y6.js')
  })
})
