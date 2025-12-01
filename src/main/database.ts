import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { createHash } from 'crypto'

const dbPath = join(app.getPath('userData'), 'duplicatizerarator.db')
const db = new Database(dbPath)

export function initDatabase(): void {
  // Check if we need to migrate (simple check: if partial_hash column exists)
  try {
    const info = db.prepare("PRAGMA table_info(files)").all() as any[]
    const hasPartialHash = info.some(col => col.name === 'partial_hash')
    
    if (!hasPartialHash) {
      // Drop and recreate for simplicity as requested by user (force refresh option implies they are okay with reindexing)
      db.exec('DROP TABLE IF EXISTS files')
    }
  } catch (err) {
    // Ignore
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      size INTEGER NOT NULL,
      partial_hash TEXT,
      full_hash TEXT,
      mtime REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_path TEXT NOT NULL,
      moved_path TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS excluded_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_files_full_hash ON files(full_hash);
    CREATE INDEX IF NOT EXISTS idx_files_partial_hash ON files(partial_hash);
    CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
  `)
}

export function upsertFile(path: string, size: number, mtime: number): void {
  // Only reset hashes if size or mtime changed
  const stmt = db.prepare(`
    INSERT INTO files (path, size, mtime, partial_hash, full_hash) 
    VALUES (?, ?, ?, NULL, NULL)
    ON CONFLICT(path) DO UPDATE SET
      partial_hash = CASE WHEN files.size != excluded.size OR files.mtime != excluded.mtime THEN NULL ELSE files.partial_hash END,
      full_hash = CASE WHEN files.size != excluded.size OR files.mtime != excluded.mtime THEN NULL ELSE files.full_hash END,
      size = excluded.size,
      mtime = excluded.mtime
  `)
  stmt.run(path, size, mtime)
}

export function upsertFilesBatch(files: { path: string, size: number, mtime: number }[]): void {
  if (files.length === 0) return

  const insert = db.prepare(`
    INSERT INTO files (path, size, mtime, partial_hash, full_hash) 
    VALUES (@path, @size, @mtime, NULL, NULL)
    ON CONFLICT(path) DO UPDATE SET
      partial_hash = CASE WHEN files.size != excluded.size OR files.mtime != excluded.mtime THEN NULL ELSE files.partial_hash END,
      full_hash = CASE WHEN files.size != excluded.size OR files.mtime != excluded.mtime THEN NULL ELSE files.full_hash END,
      size = excluded.size,
      mtime = excluded.mtime
  `)

  const insertMany = db.transaction((files) => {
    for (const file of files) insert.run(file)
  })

  insertMany(files)
}

export function updateFileHash(path: string, partialHash: string | null, fullHash: string | null): void {
  const stmt = db.prepare(`
    UPDATE files 
    SET partial_hash = ?, full_hash = ? 
    WHERE path = ?
  `)
  stmt.run(partialHash, fullHash, path)
}

export function getAllFilesMap(): Map<string, { size: number, mtime: number }> {
  const files = db.prepare('SELECT path, size, mtime FROM files').all() as { path: string, size: number, mtime: number }[]
  const map = new Map<string, { size: number, mtime: number }>()
  for (const file of files) {
    map.set(file.path, { size: file.size, mtime: file.mtime })
  }
  return map
}

export function deleteFiles(paths: string[]): void {
  if (paths.length === 0) return
  const placeholders = paths.map(() => '?').join(',')
  db.prepare(`DELETE FROM files WHERE path IN (${placeholders})`).run(...paths)
}

export function addExcludedFolder(path: string): void {
  db.prepare('INSERT OR IGNORE INTO excluded_folders (path) VALUES (?)').run(path)
}

export function getExcludedFolders(): string[] {
  return db.prepare('SELECT path FROM excluded_folders').all().map((row: any) => row.path)
}

export function removeExcludedFolder(path: string): void {
  db.prepare('DELETE FROM excluded_folders WHERE path = ?').run(path)
}

export function removeFilesByPrefix(folderPath: string): void {
  // SQLite LIKE is case-insensitive by default for ASCII characters, but we should be careful with paths
  // We want to delete files that start with the folder path
  // Ensure folderPath ends with a separator to avoid partial matches (e.g. excluding /tmp should not exclude /tmp2)
  // But wait, if we exclude c:\AMD, we want c:\AMD\foo. So we just check if path starts with folderPath + separator OR path IS folderPath
  
  // Actually, for simplicity and performance, let's just use LIKE with %
  // We need to be careful about the separator.
  // Ideally we normalize paths, but here we assume paths are consistent.
  
  // Let's just use a simple LIKE query.
  // Note: Windows paths might use backslashes.
  
  db.prepare('DELETE FROM files WHERE path LIKE ? OR path = ?').run(`${folderPath}\\%`, folderPath)
  // Also handle forward slashes just in case
  db.prepare('DELETE FROM files WHERE path LIKE ? OR path = ?').run(`${folderPath}/%`, folderPath)
}

export function getDuplicates(options: { 
  limit?: number, 
  offset?: number, 
  search?: string, 
  minSize?: number 
} = {}): any[] {
  const { limit = 50, offset = 0, search = '', minSize = 0 } = options

  // 1. Get paginated hashes (using full_hash)
  let hashQuery = `
    SELECT full_hash as hash FROM files 
    WHERE full_hash IS NOT NULL
  `
  const params: any[] = []

  if (search) {
    hashQuery += ` AND path LIKE ?`
    params.push(`%${search}%`)
  }

  if (minSize > 0) {
    hashQuery += ` AND size >= ?`
    params.push(minSize)
  }

  hashQuery += `
    GROUP BY full_hash 
    HAVING COUNT(*) > 1
    ORDER BY full_hash
    LIMIT ? OFFSET ?
  `
  params.push(limit, offset)

  const hashes = db.prepare(hashQuery).all(...params).map((row: any) => row.hash)

  if (hashes.length === 0) return []

  // 2. Get files for these hashes
  const placeholders = hashes.map(() => '?').join(',')
  return db.prepare(`
    SELECT id, path, size, full_hash as hash, created_at FROM files 
    WHERE full_hash IN (${placeholders})
    ORDER BY full_hash
  `).all(...hashes)
}

export function clearFiles(): void {
  db.exec('DELETE FROM files')
}

export function getDuplicateFolders(): any[] {
  // 1. Get all files with full_hash (meaning they are duplicates of something)
  // We need path and hash to build folder fingerprints
  const files = db.prepare(`
    SELECT path, full_hash, size FROM files 
    WHERE full_hash IS NOT NULL
    ORDER BY path
  `).all() as { path: string, full_hash: string, size: number }[]

  if (files.length === 0) return []

  // 2. Group by folder
  const folders = new Map<string, { files: any[], size: number }>()
  
  for (const file of files) {
    // Get directory path (cross-platform safe)
    const dir = file.path.substring(0, Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\')))
    
    if (!folders.has(dir)) {
      folders.set(dir, { files: [], size: 0 })
    }
    const folder = folders.get(dir)!
    folder.files.push(file)
    folder.size += file.size
  }

  // 3. Generate Fingerprints
  // Fingerprint = Hash of (Sorted List of (Filename + FileHash))
  // This ensures that if a folder has the same files (names and content), it gets the same fingerprint.
  const folderFingerprints = new Map<string, any[]>()

  for (const [dir, data] of folders) {
    // Sort files by name to ensure deterministic order
    data.files.sort((a, b) => {
      const nameA = a.path.split(/[/\\]/).pop()!
      const nameB = b.path.split(/[/\\]/).pop()!
      return nameA.localeCompare(nameB)
    })

    // Create fingerprint string
    const fingerprintStr = data.files.map(f => {
      const name = f.path.split(/[/\\]/).pop()!
      return `${name}:${f.full_hash}`
    }).join('|')

    const fingerprint = createHash('sha256').update(fingerprintStr).digest('hex')

    if (!folderFingerprints.has(fingerprint)) {
      folderFingerprints.set(fingerprint, [])
    }
    folderFingerprints.get(fingerprint)!.push({
      path: dir,
      size: data.size,
      fileCount: data.files.length,
      files: data.files
    })
  }

  // 4. Filter for duplicates (groups > 1)
  const result: any[] = []
  for (const [fingerprint, group] of folderFingerprints) {
    if (group.length > 1) {
      result.push(group)
    }
  }
  
  console.log(`[Database] Found ${result.length} duplicate folder groups.`)
  return result
}

export function getDuplicateStats(): { totalFiles: number, originalFiles: number, duplicateFolders: number } {
  // 1. Get total files involved in duplicates
  const totalFilesResult = db.prepare(`
    SELECT COUNT(*) as count FROM files 
    WHERE full_hash IN (
      SELECT full_hash FROM files 
      WHERE full_hash IS NOT NULL 
      GROUP BY full_hash 
      HAVING COUNT(*) > 1
    )
  `).get() as { count: number }

  // 2. Get number of original files (unique hashes)
  const originalFilesResult = db.prepare(`
    SELECT COUNT(DISTINCT full_hash) as count FROM files 
    WHERE full_hash IS NOT NULL 
    GROUP BY full_hash 
    HAVING COUNT(*) > 1
  `).all() // We need to count the rows returned by GROUP BY

  // 3. Get duplicate folders count
  // This is a bit expensive to calculate fully every time, but let's try to reuse the logic or simplify
  // For now, let's call the existing function as it's the source of truth
  const folders = getDuplicateFolders()
  
  return {
    totalFiles: totalFilesResult.count,
    originalFiles: originalFilesResult.length,
    duplicateFolders: folders.length
  }
}

export default db
