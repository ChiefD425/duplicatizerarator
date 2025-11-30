import fs from 'fs';
import xxhash from 'xxhash-wasm';

// Constants from dupeguru/czkawka
const CHUNK_SIZE = 1024 * 1024; // 1MB
const PARTIAL_OFFSET = 0x4000; // 16KB
const PARTIAL_SIZE = 0x4000; // 16KB
const MIN_FILE_SIZE_FOR_SAMPLING = 3 * CHUNK_SIZE; // 3MB

let hasherInstance: any = null;

export async function initHasher() {
  if (!hasherInstance) {
    hasherInstance = await xxhash();
  }
  return hasherInstance;
}

export class FileEntry {
  path: string;
  size: number;
  mtime: number;
  inode: number | bigint;
  
  private _partialHash: string | null = null;
  private _fullHash: string | null = null;

  constructor(path: string, stats: fs.Stats) {
    this.path = path;
    this.size = stats.size;
    this.mtime = stats.mtimeMs;
    this.inode = stats.ino;
  }

  async getPartialHash(): Promise<string> {
    if (this._partialHash) return this._partialHash;

    await initHasher();
    
    // If file is small, just hash the whole thing
    if (this.size < PARTIAL_OFFSET + PARTIAL_SIZE) {
      this._partialHash = await this.getFullHash();
      return this._partialHash;
    }

    const fd = await fs.promises.open(this.path, 'r');
    try {
      const buffer = Buffer.alloc(PARTIAL_SIZE);
      const { bytesRead } = await fd.read(buffer, 0, PARTIAL_SIZE, PARTIAL_OFFSET);
      // Use xxh3 (64-bit) for speed, or xxh128 if collision resistance is paramount.
      // Czkawka uses xxh3 or Blake3. xxhash-wasm provides h64 and h32.
      // We'll use h64 for now as it's very fast.
      this._partialHash = hasherInstance.h64Raw(buffer.subarray(0, bytesRead)).toString(16);
    } finally {
      await fd.close();
    }
    return this._partialHash!;
  }

  async getFullHash(): Promise<string> {
    if (this._fullHash) return this._fullHash;

    await initHasher();

    // Sample hashing for large files (optional, can be toggled)
    // For now, let's implement standard full hash but efficient streaming
    // If we want to implement "Sample Hashing" like dupeguru:
    if (this.size > MIN_FILE_SIZE_FOR_SAMPLING) {
        return this.getSampleHash();
    }

    const stream = fs.createReadStream(this.path);
    const hasher = hasherInstance.create64();
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        hasher.update(chunk);
      });
      stream.on('end', () => {
        this._fullHash = hasher.digest().toString(16);
        resolve(this._fullHash!);
      });
      stream.on('error', reject);
    });
  }

  async getSampleHash(): Promise<string> {
    // Sample: Start (1MB), Middle (1MB), End (1MB)
    const fd = await fs.promises.open(this.path, 'r');
    const hasher = hasherInstance.create64();
    const buffer = Buffer.alloc(CHUNK_SIZE);

    try {
        // Start
        let { bytesRead } = await fd.read(buffer, 0, CHUNK_SIZE, 0);
        hasher.update(buffer.subarray(0, bytesRead));

        // Middle
        const middle = Math.floor(this.size * 0.60);
        ({ bytesRead } = await fd.read(buffer, 0, CHUNK_SIZE, middle));
        hasher.update(buffer.subarray(0, bytesRead));

        // End
        const end = Math.max(0, this.size - CHUNK_SIZE);
        ({ bytesRead } = await fd.read(buffer, 0, CHUNK_SIZE, end));
        hasher.update(buffer.subarray(0, bytesRead));

        this._fullHash = hasher.digest().toString(16);
        return this._fullHash!;
    } finally {
        await fd.close();
    }
  }
}
