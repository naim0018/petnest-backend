/**
 * Allows valid http/https URLs (blocking quotes, angle brackets, backticks, whitespace)
 * or safe single-slash relative paths (blocking '//' protocol-relative URLs and '..' traversal).
 */
export const SAFE_URL_REGEX =
  /^(?:https?:\/\/[^\s<>"'`]+|\/(?!\/)(?!.*\.\.)[a-zA-Z0-9_\-./]+)$/i;

/**
 * Matches standard 36-character UUID strings.
 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
