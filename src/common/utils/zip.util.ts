import * as zlib from 'zlib';
import { BadRequestException } from '@nestjs/common';

export interface ExtractedZipEntry {
  path: string;
  name: string;
  buffer: Buffer;
}

const MAX_TOTAL_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150MB total extracted data cap (Zip-Bomb defense)
const MAX_FILE_ENTRIES = 150; // Max 150 files per archive
const MAX_SINGLE_FILE_BYTES = 30 * 1024 * 1024; // 30MB max for any single file

/**
 * Pure Node.js in-memory ZIP extractor using standard zlib and PKZIP central directory.
 * Requires 0 external npm dependencies, memory-safe, and protects against Zip-Slip & Zip-Bomb attacks.
 */
export function extractZipInMemory(buffer: Buffer): Map<string, Buffer> {
  if (!buffer || buffer.length < 22) {
    throw new BadRequestException(
      'Invalid archive: File is too small to be a valid ZIP',
    );
  }

  // 0. Verify magic PK header bytes
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new BadRequestException(
      'Invalid archive: File header is not a PKZIP signature',
    );
  }

  // 1. Locate End of Central Directory (EOCD) signature 0x06054b50 (search backwards from end)
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.length, 65536 + 22);
  for (let i = buffer.length - 22; i >= buffer.length - maxSearch; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new BadRequestException(
      'Corrupted or invalid ZIP file: End of Central Directory signature not found',
    );
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries > MAX_FILE_ENTRIES) {
    throw new BadRequestException(
      `Archive contains ${totalEntries} entries, exceeding the maximum limit of ${MAX_FILE_ENTRIES} files`,
    );
  }

  if (cdOffset >= buffer.length) {
    throw new BadRequestException(
      'Invalid ZIP structure: Central directory offset is out of bounds',
    );
  }

  const files = new Map<string, Buffer>();
  let offset = cdOffset;
  let totalUncompressedBytes = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > buffer.length) break;
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const rawFileName = buffer.toString(
      'utf8',
      offset + 46,
      offset + 46 + fileNameLen,
    );
    offset += 46 + fileNameLen + extraLen + commentLen;

    // Normalize path and prevent Zip-Slip path traversal
    const normalizedPath = rawFileName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (
      normalizedPath.includes('..') ||
      normalizedPath.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalizedPath)
    ) {
      continue;
    }

    if (normalizedPath.endsWith('/')) {
      continue; // Directory entry
    }

    // Pre-check uncompressed size from header against single file cap
    if (uncompressedSize > MAX_SINGLE_FILE_BYTES) {
      throw new BadRequestException(
        `File "${normalizedPath}" exceeds maximum allowable single file size (30MB)`,
      );
    }

    if (localHeaderOffset + 30 > buffer.length) continue;

    const localFileNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLen + localExtraLen;

    if (dataStart + compressedSize > buffer.length) continue;

    const rawData = buffer.subarray(dataStart, dataStart + compressedSize);

    let fileData: Buffer;
    if (method === 0) {
      fileData = Buffer.from(rawData);
    } else if (method === 8) {
      try {
        fileData = zlib.inflateRawSync(rawData, {
          maxOutputLength: MAX_SINGLE_FILE_BYTES,
        });
      } catch {
        continue;
      }
    } else {
      continue;
    }

    totalUncompressedBytes += fileData.length;
    if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new BadRequestException(
        `Total uncompressed data exceeds safety limit of ${MAX_TOTAL_UNCOMPRESSED_BYTES / (1024 * 1024)}MB`,
      );
    }

    files.set(normalizedPath, fileData);
  }

  return files;
}

export interface ZipFileEntry {
  path: string;
  data: Buffer | string;
}

/**
 * Pure Node.js in-memory ZIP packager using standard zlib and PKZIP central directory.
 * Requires 0 external npm dependencies, fast, and generates valid standard .zip archives.
 */
export function createZipInMemory(entries: ZipFileEntry[]): Buffer {
  const localChunks: Buffer[] = [];
  const cdChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const normalizedPath = entry.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const fileNameBuf = Buffer.from(normalizedPath, 'utf8');
    const uncompressedData: Buffer = Buffer.isBuffer(entry.data)
      ? Buffer.from(entry.data)
      : Buffer.from(entry.data, 'utf8');
    const uncompressedSize = uncompressedData.length;
    const crc = zlib.crc32(uncompressedData);

    const deflated = zlib.deflateRawSync(uncompressedData);
    let method = 8;
    let compressedData: Buffer = deflated;
    let compressedSize = deflated.length;
    if (deflated.length >= uncompressedSize) {
      method = 0;
      compressedData = Buffer.from(uncompressedData);
      compressedSize = uncompressedSize;
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(fileNameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localOffset = offset;
    localChunks.push(localHeader, fileNameBuf, compressedData);
    offset += 30 + fileNameBuf.length + compressedSize;

    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0x0800, 8);
    cdHeader.writeUInt16LE(method, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(fileNameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(localOffset, 42);

    cdChunks.push(cdHeader, fileNameBuf);
  }

  const cdOffset = offset;
  const cdBuf = Buffer.concat(cdChunks);
  const cdSize = cdBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, cdBuf, eocd]);
}
