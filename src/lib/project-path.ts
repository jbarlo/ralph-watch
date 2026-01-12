/**
 * URL-safe encoding/decoding for project paths
 * Uses base64url format (no padding, URL-safe characters)
 */

/**
 * Encode a project path for use in URLs
 * Uses base64url encoding (no padding, - and _ instead of + and /)
 */
export function encodeProjectPath(path: string): string {
  // Convert to base64
  const base64 = Buffer.from(path, 'utf-8').toString('base64');
  // Convert to base64url (replace + with -, / with _, remove padding)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a URL-safe encoded project path
 */
export function decodeProjectPath(encoded: string): string {
  // Convert base64url back to base64
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(paddingNeeded);
  // Decode
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Check if a string is a valid base64url encoded path
 */
export function isValidEncodedPath(encoded: string): boolean {
  // base64url only contains alphanumeric, -, and _
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
    return false;
  }
  try {
    const decoded = decodeProjectPath(encoded);
    // A valid path should start with / (absolute path)
    return decoded.startsWith('/');
  } catch {
    return false;
  }
}

/**
 * Build URL for a project page
 */
export function buildProjectUrl(path: string): string {
  return `/project/${encodeProjectPath(path)}`;
}
