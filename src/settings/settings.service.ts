import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { PrismaService } from 'src/prisma/prisma.service';

export interface GeminiConfigResponse {
  isConfigured: boolean;
  maskedKey: string;
  source: 'DATABASE' | 'ENV' | 'NONE';
  updatedAt: Date | null;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves decrypted secret setting from database if present and valid.
   */
  async getDecryptedSecret(key: string): Promise<string | null> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!setting || !setting.value) {
        return null;
      }

      if (setting.isSecret) {
        if (!setting.iv || !setting.authTag) {
          this.logger.warn(
            `Setting ${key} is secret but missing iv or authTag.`,
          );
          return null;
        }
        return CryptoUtil.decryptAes256Gcm(
          setting.value,
          setting.iv,
          setting.authTag,
        );
      }

      return setting.value;
    } catch (err: any) {
      this.logger.error(
        `Failed to decrypt secret setting ${key}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Resolves the active Gemini API key:
   * 1. Checks encrypted DB setting first.
   * 2. Falls back to process.env.GEMINI_API_KEY.
   */
  async getResolvedGeminiKey(): Promise<string | null> {
    const dbKey = await this.getDecryptedSecret('GEMINI_API_KEY');
    if (dbKey && dbKey.trim().length > 0) {
      return dbKey.trim();
    }

    const envKey = process.env.GEMINI_API_KEY?.trim();
    if (envKey && envKey.length > 0) {
      return envKey;
    }

    return null;
  }

  /**
   * Returns current Gemini configuration metadata without exposing raw key.
   */
  async getGeminiConfig(): Promise<GeminiConfigResponse> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'GEMINI_API_KEY' },
    });

    if (setting && setting.value) {
      let raw = '';
      if (setting.isSecret && setting.iv && setting.authTag) {
        try {
          raw = CryptoUtil.decryptAes256Gcm(
            setting.value,
            setting.iv,
            setting.authTag,
          );
        } catch {
          raw = '';
        }
      } else {
        raw = setting.value;
      }

      const maskedKey =
        raw.length > 4 ? `••••••••••••${raw.slice(-4)}` : '••••••••••••';

      return {
        isConfigured: true,
        maskedKey,
        source: 'DATABASE',
        updatedAt: setting.updatedAt,
      };
    }

    const envKey = process.env.GEMINI_API_KEY?.trim();
    if (envKey && envKey.length > 0) {
      const maskedKey =
        envKey.length > 4 ? `••••••••••••${envKey.slice(-4)}` : '••••••••••••';

      return {
        isConfigured: true,
        maskedKey,
        source: 'ENV',
        updatedAt: null,
      };
    }

    return {
      isConfigured: false,
      maskedKey: '',
      source: 'NONE',
      updatedAt: null,
    };
  }

  /**
   * Encrypts and securely saves Gemini API Key in the database with AES-256-GCM.
   */
  async saveGeminiKey(
    apiKey: string,
    userId?: string,
  ): Promise<GeminiConfigResponse> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new BadRequestException('API key cannot be empty');
    }

    const encrypted = CryptoUtil.encryptAes256Gcm(trimmed);

    await this.prisma.systemSetting.upsert({
      where: { key: 'GEMINI_API_KEY' },
      create: {
        key: 'GEMINI_API_KEY',
        value: encrypted.ciphertext,
        isSecret: true,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        description: 'Google Gemini AI API Key (AES-256-GCM Encrypted)',
        updatedById: userId,
      },
      update: {
        value: encrypted.ciphertext,
        isSecret: true,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        description: 'Google Gemini AI API Key (AES-256-GCM Encrypted)',
        updatedById: userId,
      },
    });

    return this.getGeminiConfig();
  }

  /**
   * Removes Gemini API Key from database (falls back to ENV if present).
   */
  async removeGeminiKey(): Promise<GeminiConfigResponse> {
    try {
      await this.prisma.systemSetting.delete({
        where: { key: 'GEMINI_API_KEY' },
      });
    } catch {
      // Ignored if does not exist
    }

    return this.getGeminiConfig();
  }

  /**
   * Verifies Gemini API connectivity and key validity against Google API.
   */
  async testGeminiConnectivity(rawKey?: string): Promise<{
    success: boolean;
    message: string;
    modelCount?: number;
  }> {
    const keyToTest = rawKey?.trim() || (await this.getResolvedGeminiKey());

    if (!keyToTest) {
      throw new BadRequestException(
        'No Gemini API key provided or found in system settings.',
      );
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToTest}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg =
          data?.error?.message ||
          `Google API returned HTTP status ${response.status} (${response.statusText})`;
        throw new BadRequestException(
          `Gemini API connection failed: ${errorMsg}`,
        );
      }

      const modelCount = Array.isArray(data?.models) ? data.models.length : 0;
      return {
        success: true,
        message: 'Successfully verified connection to Google Gemini API!',
        modelCount,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Error verifying Gemini connectivity: ${err.message}`);
      throw new InternalServerErrorException(
        `Failed to reach Google Gemini API: ${err.message}`,
      );
    }
  }
}
