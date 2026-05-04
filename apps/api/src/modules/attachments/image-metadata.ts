import { promises as fs } from "fs";

export function detectImageMimeType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return "image/gif";
  }

  return undefined;
}

export async function detectImageMimeTypeFromFile(filePath: string) {
  const file = await fs.open(filePath, "r");

  try {
    const signatureBuffer = Buffer.alloc(16);
    const { bytesRead } = await file.read(signatureBuffer, 0, signatureBuffer.length, 0);
    return detectImageMimeType(signatureBuffer.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}

export function getImageDimensionsFromBuffer(fileBuffer: Buffer, mimeType: string) {
  if (mimeType === "image/png" && fileBuffer.length >= 24) {
    return {
      width: fileBuffer.readUInt32BE(16),
      height: fileBuffer.readUInt32BE(20),
    };
  }

  if (mimeType === "image/gif" && fileBuffer.length >= 10) {
    return {
      width: fileBuffer.readUInt16LE(6),
      height: fileBuffer.readUInt16LE(8),
    };
  }

  if (mimeType === "image/webp" && fileBuffer.length >= 30) {
    const chunkType = fileBuffer.subarray(12, 16).toString("ascii");

    if (chunkType === "VP8X") {
      return {
        width: 1 + fileBuffer.readUIntLE(24, 3),
        height: 1 + fileBuffer.readUIntLE(27, 3),
      };
    }

    if (chunkType === "VP8 " && fileBuffer.length >= 30) {
      return {
        width: fileBuffer.readUInt16LE(26),
        height: fileBuffer.readUInt16LE(28),
      };
    }

    if (chunkType === "VP8L" && fileBuffer.length >= 25) {
      const bits = fileBuffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  if (mimeType === "image/jpeg") {
    let offset = 2;

    while (offset + 9 < fileBuffer.length) {
      if (fileBuffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = fileBuffer[offset + 1];
      const isStartOfFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isStartOfFrame) {
        return {
          height: fileBuffer.readUInt16BE(offset + 5),
          width: fileBuffer.readUInt16BE(offset + 7),
        };
      }

      if (offset + 4 > fileBuffer.length) {
        break;
      }

      const segmentLength = fileBuffer.readUInt16BE(offset + 2);

      if (segmentLength < 2) {
        break;
      }

      offset += 2 + segmentLength;
    }
  }

  return {
    width: null,
    height: null,
  };
}

export async function getImageDimensionsFromFile(filePath: string, mimeType: string) {
  const fileBuffer = await fs.readFile(filePath);
  return getImageDimensionsFromBuffer(fileBuffer, mimeType);
}
