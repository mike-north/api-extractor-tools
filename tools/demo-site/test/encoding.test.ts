import { describe, it, expect } from 'vitest'
import { encodeBase64, decodeBase64 } from '../src/utils/encoding'

describe('encodeBase64', () => {
  it('encodes simple ASCII string', () => {
    const result = encodeBase64('hello')

    expect(result).toBe('aGVsbG8=')
  })

  it('encodes empty string', () => {
    const result = encodeBase64('')

    expect(result).toBe('')
  })

  it('encodes string with spaces', () => {
    const result = encodeBase64('hello world')

    expect(result).toBe('aGVsbG8gd29ybGQ=')
  })

  it('encodes string with special characters', () => {
    const input = 'Hello, World! @#$%^&*()'
    const encoded = encodeBase64(input)

    // Should be decodable back to original
    expect(decodeBase64(encoded)).toBe(input)
  })

  it('encodes emoji characters', () => {
    const input = '😀🎉🚀'
    const encoded = encodeBase64(input)

    // Should be decodable back to original
    expect(decodeBase64(encoded)).toBe(input)
  })

  it('encodes non-ASCII characters (UTF-8)', () => {
    const input = '日本語テスト'
    const encoded = encodeBase64(input)

    // Should be decodable back to original
    expect(decodeBase64(encoded)).toBe(input)
  })

  it('encodes mixed content', () => {
    const input = 'Hello 世界 🌍!'
    const encoded = encodeBase64(input)

    // Should be decodable back to original
    expect(decodeBase64(encoded)).toBe(input)
  })

  it('encodes newlines and whitespace', () => {
    const input = 'line1\nline2\ttab'
    const encoded = encodeBase64(input)

    expect(decodeBase64(encoded)).toBe(input)
  })

  it('encodes declaration file content', () => {
    const input = 'export declare function foo(): void;'
    const encoded = encodeBase64(input)

    expect(decodeBase64(encoded)).toBe(input)
  })
})

describe('decodeBase64', () => {
  it('decodes simple ASCII string', () => {
    const result = decodeBase64('aGVsbG8=')

    expect(result).toBe('hello')
  })

  it('decodes empty string', () => {
    const result = decodeBase64('')

    expect(result).toBe('')
  })

  it('returns empty string for invalid base64', () => {
    const result = decodeBase64('not-valid-base64!')

    expect(result).toBe('')
  })

  it('returns empty string for truncated base64', () => {
    // Missing padding - atob handles this, but we test for graceful handling
    const result = decodeBase64('!!!invalid!!!')

    // Should return empty string on decode failure
    expect(result).toBe('')
  })

  it('decodes standard base64 alphabet correctly', () => {
    // Test with characters from the full base64 alphabet
    const original = 'The quick brown fox jumps over the lazy dog 0123456789'
    const encoded = encodeBase64(original)
    const decoded = decodeBase64(encoded)

    expect(decoded).toBe(original)
  })
})

describe('roundtrip encoding/decoding', () => {
  const testCases = [
    'simple text',
    '',
    'line1\nline2',
    '   spaces   ',
    'unicode: αβγδ',
    'emoji: 🎉💻🔥',
    'mixed: Hello 世界 🌍!',
    'export declare function greet(name: string): string;',
    'interface User {\n  name: string;\n  age: number;\n}',
    'type Status = "active" | "inactive" | "pending";',
  ]

  testCases.forEach((input) => {
    it(`roundtrips: "${input.slice(0, 30)}${input.length > 30 ? '...' : ''}"`, () => {
      const encoded = encodeBase64(input)
      const decoded = decodeBase64(encoded)

      expect(decoded).toBe(input)
    })
  })
})
