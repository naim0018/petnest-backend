import * as crypto from 'crypto';

export class CryptoUtil {
  /**
   * Generates a cryptographically secure random hex token and its SHA-256 hash.
   */
  static generateRandomToken(bytes: number = 32): {
    rawToken: string;
    hashedToken: string;
  } {
    const rawToken = crypto.randomBytes(bytes).toString('hex');
    const hashedToken = this.hashSha256(rawToken);
    return { rawToken, hashedToken };
  }

  /**
   * Hashes an arbitrary-length string (e.g. JWT refresh token or reset token) with SHA-256.
   * Unlike bcrypt, SHA-256 does not truncate inputs at 72 bytes.
   */
  static hashSha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Constant-time comparison between a raw token and a stored SHA-256 hex digest.
   */
  static verifySha256(rawData: string, expectedHexHash: string): boolean {
    if (!expectedHexHash || expectedHexHash.length !== 64) {
      return false;
    }
    const actualBuf = Buffer.from(this.hashSha256(rawData), 'hex');
    const expectedBuf = Buffer.from(expectedHexHash, 'hex');
    if (actualBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  }
}
