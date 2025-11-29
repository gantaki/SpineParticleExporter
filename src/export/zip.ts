/**
 * ZIP Utilities
 * Simple ZIP file creation and download helpers
 */

/**
 * Simple ZIP file creator without external dependencies
 */
export class SimpleZip {
  private files: Array<{ name: string; data: Uint8Array }> = [];

  /**
   * Add a file to the ZIP
   */
  addFile(name: string, data: string | Uint8Array): void {
    const uint8Data =
      typeof data === "string" ? new TextEncoder().encode(data) : data;
    this.files.push({ name, data: uint8Data });
  }

  /**
   * Add a canvas as PNG to the ZIP
   */
  async addCanvasFile(name: string, canvas: HTMLCanvasElement): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to blob"));
          return;
        }
        blob
          .arrayBuffer()
          .then((buffer) => {
            this.addFile(name, new Uint8Array(buffer));
            resolve();
          })
          .catch(reject);
      }, "image/png");
    });
  }

  /**
   * Generate the ZIP file as a Blob
   */
  generate(): Blob {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const centralDirectory: Uint8Array[] = [];

    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const crc = this.crc32(file.data);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);

      // Local file header signature
      view.setUint32(0, 0x04034b50, true);
      // Version needed to extract
      view.setUint16(4, 20, true);
      // General purpose bit flag
      view.setUint16(6, 0, true);
      // Compression method (0 = store)
      view.setUint16(8, 0, true);
      // File modification time
      view.setUint16(10, 0, true);
      // File modification date
      view.setUint16(12, 0, true);
      // CRC-32
      view.setUint32(14, crc, true);
      // Compressed size
      view.setUint32(18, file.data.length, true);
      // Uncompressed size
      view.setUint32(22, file.data.length, true);
      // File name length
      view.setUint16(26, nameBytes.length, true);
      // Extra field length
      view.setUint16(28, 0, true);

      localHeader.set(nameBytes, 30);
      chunks.push(localHeader);
      chunks.push(file.data);

      // Central directory header
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(centralHeader.buffer);

      // Central directory signature
      cdView.setUint32(0, 0x02014b50, true);
      // Version made by
      cdView.setUint16(4, 20, true);
      // Version needed to extract
      cdView.setUint16(6, 20, true);
      // General purpose bit flag
      cdView.setUint16(8, 0, true);
      // Compression method
      cdView.setUint16(10, 0, true);
      // File modification time
      cdView.setUint16(12, 0, true);
      // File modification date
      cdView.setUint16(14, 0, true);
      // CRC-32
      cdView.setUint32(16, crc, true);
      // Compressed size
      cdView.setUint32(20, file.data.length, true);
      // Uncompressed size
      cdView.setUint32(24, file.data.length, true);
      // File name length
      cdView.setUint16(28, nameBytes.length, true);
      // Extra field length
      cdView.setUint16(30, 0, true);
      // File comment length
      cdView.setUint16(32, 0, true);
      // Disk number start
      cdView.setUint16(34, 0, true);
      // Internal file attributes
      cdView.setUint16(36, 0, true);
      // External file attributes
      cdView.setUint32(38, 0, true);
      // Relative offset of local header
      cdView.setUint32(42, offset, true);

      centralHeader.set(nameBytes, 46);
      centralDirectory.push(centralHeader);

      offset += localHeader.length + file.data.length;
    }

    // Combine central directory entries
    const centralDirData = new Uint8Array(
      centralDirectory.reduce((sum, cd) => sum + cd.length, 0)
    );
    let cdOffset = 0;
    for (const cd of centralDirectory) {
      centralDirData.set(cd, cdOffset);
      cdOffset += cd.length;
    }

    // End of central directory record
    const endOfCentralDir = new Uint8Array(22);
    const eocdView = new DataView(endOfCentralDir.buffer);

    // End of central directory signature
    eocdView.setUint32(0, 0x06054b50, true);
    // Number of this disk
    eocdView.setUint16(4, 0, true);
    // Disk where central directory starts
    eocdView.setUint16(6, 0, true);
    // Number of central directory records on this disk
    eocdView.setUint16(8, this.files.length, true);
    // Total number of central directory records
    eocdView.setUint16(10, this.files.length, true);
    // Size of central directory
    eocdView.setUint32(12, centralDirData.length, true);
    // Offset of start of central directory
    eocdView.setUint32(16, offset, true);
    // Comment length
    eocdView.setUint16(20, 0, true);

    // Combine all parts
    const totalSize =
      chunks.reduce((sum, chunk) => sum + chunk.length, 0) +
      centralDirData.length +
      endOfCentralDir.length;
    const result = new Uint8Array(totalSize);

    let resultOffset = 0;
    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }
    result.set(centralDirData, resultOffset);
    resultOffset += centralDirData.length;
    result.set(endOfCentralDir, resultOffset);

    return new Blob([result], { type: "application/zip" });
  }

  /**
   * Calculate CRC-32 checksum
   */
  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}

/**
 * Download a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
