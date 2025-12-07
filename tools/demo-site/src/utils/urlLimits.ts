/**
 * URL length limit constants and utilities for browser compatibility.
 *
 * Different browsers and servers have different URL length limits:
 * - Chromium-based browsers: ~8000 characters (GitHub nginx: 8201)
 * - Other browsers (Safari, Firefox): ~2000 characters for broad compatibility
 *
 * @see https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
 */

/**
 * Maximum URL length for Chromium-based browsers.
 * GitHub's nginx servers support up to 8201, so we use 8000 for safety margin.
 */
const CHROMIUM_URL_LIMIT = 8000

/**
 * Maximum URL length for broad browser compatibility.
 * This conservative limit works across Safari, Firefox, and older browsers.
 */
const SAFE_URL_LIMIT = 2000

/**
 * Detects if the current browser is Chromium-based.
 * Checks for Chrome, Chromium, Edge, and Opera user agent strings.
 *
 * @returns true if browser is Chromium-based, false otherwise
 */
function isChromiumBrowser(): boolean {
  const ua = navigator.userAgent
  return (
    ua.includes('Chrome') ||
    ua.includes('Chromium') ||
    ua.includes('Edge') ||
    ua.includes('Opera')
  )
}

/**
 * Gets the maximum recommended URL length for the current browser.
 *
 * @returns Maximum URL length in characters
 */
export function getMaxUrlLength(): number {
  return isChromiumBrowser() ? CHROMIUM_URL_LIMIT : SAFE_URL_LIMIT
}

/**
 * Checks if a URL exceeds the browser's safe length limit.
 *
 * @param url - The URL to check
 * @returns true if URL is too long, false otherwise
 */
export function isUrlTooLong(url: string): boolean {
  return url.length > getMaxUrlLength()
}
