import { createHash } from 'crypto'
import { open } from 'fs/promises'

const CHUNK_SIZE = 16 * 1024 // 16KB

export async function calculatePartialHash(filePath: string, size: number): Promise<string> {
  // If file is small, just hash the whole thing
  if (size <= CHUNK_SIZE * 2) {
    return calculateFullHash(filePath)
  }

  const fd = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(CHUNK_SIZE * 2)
    
    // Read first 16KB
    await fd.read(buffer, 0, CHUNK_SIZE, 0)
    
    // Read last 16KB
    await fd.read(buffer, CHUNK_SIZE, CHUNK_SIZE, size - CHUNK_SIZE)
    
    const hash = createHash('sha256')
    hash.update(buffer)
    // Also include size in the hash to be extra safe for the "partial" check
    hash.update(size.toString())
    
    return hash.digest('hex')
  } finally {
    await fd.close()
  }
}

export async function calculateFullHash(filePath: string): Promise<string> {
  const fd = await open(filePath, 'r')
  const hash = createHash('sha256')
  const buffer = Buffer.alloc(64 * 1024) // 64KB chunks for reading

  try {
    let bytesRead = 0
    while ((bytesRead = (await fd.read(buffer, 0, buffer.length, null)).bytesRead) > 0) {
      hash.update(buffer.subarray(0, bytesRead))
    }
    return hash.digest('hex')
  } finally {
    await fd.close()
  }
}
