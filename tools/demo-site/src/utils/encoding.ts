/**
 * Encodes a string to base64 using modern TextEncoder/TextDecoder.
 * Safe for UTF-8 strings including emoji and special characters.
 */
export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decodes a base64 string using modern TextEncoder/TextDecoder.
 * Returns empty string if decoding fails.
 */
export function decodeBase64(str: string): string {
  try {
    const binary = atob(str)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}
