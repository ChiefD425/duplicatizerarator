import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

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
    
    CREATE INDEX IF NOT EXISTS idx_files_full_hash ON files(full_hash);
    CREATE INDEX IF NOT EXISTS idx_files_partial_hash ON files(partial_hash);
    CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
  `)
}

export function upsertFile(path: string, size: number, mtime: number): void {
  // If the scanner calls this, it means the file is either new or modified.
  // So we should set hashes to NULL.
  const stmt = db.prepare(`
    INSERT INTO files (path, size, mtime, partial_hash, full_hash) 
    VALUES (?, ?, ?, NULL, NULL)
    ON CONFLICT(path) DO UPDATE SET
      size = excluded.size,
      mtime = excluded.mtime,
      partial_hash = NULL,
      full_hash = NULL
  `)
  stmt.run(path, size, mtime)
}

export function upsertFilesBatch(files: { path: string, size: number, mtime: number }[]): void {
  if (files.length === 0) return

  const insert = db.prepare(`
    INSERT INTO files (path, size, mtime, partial_hash, full_hash) 
    VALUES (@path, @size, @mtime, NULL, NULL)
    ON CONFLICT(path) DO UPDATE SET
      size = excluded.size,
      mtime = excluded.mtime,
      partial_hash = NULL,
      full_hash = NULL
  `)

  const insertMany = db.transaction((files) => {
    for (const file of files) insert.run(file)
  })

  insertMany(files)
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

export default db
