import { Response } from 'express';

export class CookieUtil {
  static setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    rememberMe = false,
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    // Only enforce 'secure' if explicitly enabled or if FRONTEND_URL is HTTPS.
    // Plain HTTP on VPS IP will drop cookies if secure: true is sent!
    const isSecure =
      process.env.COOKIE_SECURE === 'true' ||
      (isProd && (process.env.FRONTEND_URL || '').startsWith('https://'));

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      ...(rememberMe ? { maxAge: 1000 * 60 * 60 * 24 * 30 } : {}), // 30 days if rememberMe, otherwise session cookie
    });
  }

  static clearAuthCookies(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const isSecure =
      process.env.COOKIE_SECURE === 'true' ||
      (isProd && (process.env.FRONTEND_URL || '').startsWith('https://'));

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
    });
  }
}
