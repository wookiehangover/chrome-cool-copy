/**
 * Server-side authentication utilities
 * Handles cookie-based authentication for protected routes
 */

const AUTH_COOKIE_NAME = "all_clips_auth";

/**
 * Check if a request is authenticated by verifying the auth cookie
 * @param request - The incoming request object
 * @returns true if authenticated, false otherwise
 */
export function isAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get("Cookie");
  return cookieHeader?.includes(`${AUTH_COOKIE_NAME}=authenticated`) ?? false;
}

/**
 * Get the authentication cookie name
 * @returns The cookie name used for authentication
 */
export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

/**
 * Generate the Set-Cookie header value for authentication
 * @returns The Set-Cookie header value
 */
export function getAuthCookieHeader(): string {
  return `${AUTH_COOKIE_NAME}=authenticated; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
}
