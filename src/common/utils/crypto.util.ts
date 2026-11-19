import * as crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class CryptoUtil {
  private static getEncryptionKey(): Buffer {
    const rawSecret =
      process.env.ENCRYPTION_SECRET ||
      process.env.JWT_SECRET ||
      'petnest-default-secure-fallback-key-32b';
    return crypto.scryptSync(rawSecret, 'petnest_settings_salt_v1', 32);
  }

  /**
   * Encrypts plaintext using AES-256-GCM authenticated encryption.
   */
  static encryptAes256Gcm(plaintext: string): EncryptedPayload {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypts ciphertext using AES-256-GCM and verifies authenticity tag.
   */
  static decryptAes256Gcm(
    ciphertext: string,
    ivHex: string,
    authTagHex: string,
  ): string {
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

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
