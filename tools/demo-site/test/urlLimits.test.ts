import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMaxUrlLength, isUrlTooLong } from '../src/utils/urlLimits'

describe('urlLimits', () => {
  const originalNavigator = window.navigator

  beforeEach(() => {
    // Reset navigator mock before each test
    vi.restoreAllMocks()
  })

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
    })
  })

  function mockUserAgent(userAgent: string) {
    Object.defineProperty(window, 'navigator', {
      value: { userAgent },
      writable: true,
    })
  }

  describe('getMaxUrlLength', () => {
    describe('Chromium-based browsers', () => {
      it('returns 8000 for Chrome', () => {
        mockUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        )

        expect(getMaxUrlLength()).toBe(8000)
      })

      it('returns 8000 for Chromium', () => {
        mockUserAgent(
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/120.0.0.0 Safari/537.36',
        )

        expect(getMaxUrlLength()).toBe(8000)
      })

      it('returns 8000 for Edge', () => {
        mockUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        )

        expect(getMaxUrlLength()).toBe(8000)
      })

      it('returns 8000 for Opera', () => {
        mockUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
        )

        expect(getMaxUrlLength()).toBe(8000)
      })
    })

    describe('non-Chromium browsers', () => {
      it('returns 2000 for Safari', () => {
        mockUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        )

        expect(getMaxUrlLength()).toBe(2000)
      })

      it('returns 2000 for Firefox', () => {
        mockUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        )

        expect(getMaxUrlLength()).toBe(2000)
      })

      it('returns 2000 for unknown browsers', () => {
        mockUserAgent('UnknownBrowser/1.0')

        expect(getMaxUrlLength()).toBe(2000)
      })
    })
  })

  describe('isUrlTooLong', () => {
    describe('with Chromium browser (8000 limit)', () => {
      beforeEach(() => {
        mockUserAgent('Chrome/120.0.0.0')
      })

      it('returns false for short URLs', () => {
        const shortUrl = 'https://example.com/path?query=value'

        expect(isUrlTooLong(shortUrl)).toBe(false)
      })

      it('returns false for URL exactly at limit', () => {
        const urlAtLimit = 'a'.repeat(8000)

        expect(isUrlTooLong(urlAtLimit)).toBe(false)
      })

      it('returns true for URL exceeding limit', () => {
        const longUrl = 'a'.repeat(8001)

        expect(isUrlTooLong(longUrl)).toBe(true)
      })
    })

    describe('with non-Chromium browser (2000 limit)', () => {
      beforeEach(() => {
        mockUserAgent('Firefox/120.0')
      })

      it('returns false for short URLs', () => {
        const shortUrl = 'https://example.com/path?query=value'

        expect(isUrlTooLong(shortUrl)).toBe(false)
      })

      it('returns false for URL exactly at limit', () => {
        const urlAtLimit = 'a'.repeat(2000)

        expect(isUrlTooLong(urlAtLimit)).toBe(false)
      })

      it('returns true for URL exceeding limit', () => {
        const longUrl = 'a'.repeat(2001)

        expect(isUrlTooLong(longUrl)).toBe(true)
      })

      it('returns true for URL that would be fine in Chrome but not in Firefox', () => {
        // URL that's 5000 chars - fine for Chrome, too long for Firefox
        const mediumUrl = 'a'.repeat(5000)

        expect(isUrlTooLong(mediumUrl)).toBe(true)
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty URL', () => {
      mockUserAgent('Chrome/120.0.0.0')

      expect(isUrlTooLong('')).toBe(false)
    })

    it('handles URL with special characters', () => {
      mockUserAgent('Chrome/120.0.0.0')

      const urlWithSpecialChars =
        'https://example.com/path?emoji=🎉&text=hello%20world'

      expect(isUrlTooLong(urlWithSpecialChars)).toBe(false)
    })
  })
})
