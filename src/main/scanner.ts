import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { upsertFilesBatch, clearFiles, getAllFilesMap, deleteFiles, updateFileHash } from './database'
import { BrowserWindow } from 'electron'
import { logger } from './logger'
import { FileEntry } from './fileEntry'
import { Worker } from 'worker_threads'

// Smart Exclusions
const DEFAULT_EXCLUSIONS = [
  'Windows',
  'Program Files',
  'Program Files (x86)',
  'node_modules',
  '.git',
  'AppData',
  '$Recycle.Bin',
  'System Volume Information'
]

// File Type Maps
const FILE_TYPES = {
  photos: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.raw'],
  music: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
  videos: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'],
  documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx']
}

interface ScanOptions {
  paths: string[]
  types: ('photos' | 'music' | 'videos' | 'documents')[]
  ignoreSystem: boolean
  forceRefresh?: boolean
}

let shouldCancel = false

export function cancelScan(): void {
  shouldCancel = true
}

export async function scanFiles(options: ScanOptions, mainWindow: BrowserWindow): Promise<boolean> {
  shouldCancel = false
  logger.info('Starting optimized scan...', { paths: options.paths, types: options.types, forceRefresh: options.forceRefresh })
  
  if (options.forceRefresh) {
    clearFiles()
  }
  
  // Load existing files for diffing
  const existingFiles = options.forceRefresh ? new Map() : getAllFilesMap()
  const seenPaths = new Set<string>()

  const allowedExtensions = new Set<string>()
  if (options.types.length > 0) {
    options.types.forEach(type => {
      if (FILE_TYPES[type]) {
        FILE_TYPES[type].forEach(ext => allowedExtensions.add(ext))
      }
    })
  }

  let scannedCount = 0
  let lastReportTime = Date.now()
  
  // 1. Discovery Phase (Fast)
  const filesBySize = new Map<number, FileEntry[]>()
  const queue: string[] = [...options.paths]
  
  // Helper to report progress
  const reportProgress = () => {
    const now = Date.now()
    if (now - lastReportTime > 200) {
        mainWindow.webContents.send('scan-progress', { count: scannedCount })
        lastReportTime = now
    }
  }

  while (queue.length > 0) {
    if (shouldCancel) return false
    const dir = queue.shift()!
    
    try {
        const dirents = await readdir(dir, { withFileTypes: true })
        for (const dirent of dirents) {
            const path = join(dir, dirent.name)
            
            if (options.ignoreSystem && DEFAULT_EXCLUSIONS.some(ex => path.includes(ex))) continue
            
            if (dirent.isDirectory()) {
                queue.push(path)
            } else if (dirent.isFile()) {
                const ext = extname(path).toLowerCase()
                if (allowedExtensions.size === 0 || allowedExtensions.has(ext)) {
                    try {
                        const stats = await stat(path)
                        const entry = new FileEntry(path, stats)
                        
                        if (!filesBySize.has(entry.size)) {
                            filesBySize.set(entry.size, [])
                        }
                        filesBySize.get(entry.size)!.push(entry)
                        
                        scannedCount++
                        reportProgress()
                    } catch (e) { /* ignore */ }
                }
            }
        }
    } catch (e) { /* ignore */ }
  }

  // 2. Grouping & Hashing Phase
  // Filter out unique sizes (cannot be duplicates)
  const potentialDuplicates: FileEntry[] = []
  for (const [size, entries] of filesBySize) {
      if (entries.length > 1) {
          potentialDuplicates.push(...entries)
      }
  }

  logger.info(`Found ${scannedCount} files. ${potentialDuplicates.length} are potential duplicates (by size).`)

  // 3. Parallel Hashing
  // We can use a simple worker pool or just Promise.all with concurrency limit for now since we are IO bound mostly
  // But for hashing CPU is also a factor.
  // Since we are in Electron main process, we can use standard async/await with concurrency limit.
  
  const CONCURRENCY = 4; // Adjust based on CPU cores
  const chunks = [];
  for (let i = 0; i < potentialDuplicates.length; i += CONCURRENCY) {
      chunks.push(potentialDuplicates.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
      if (shouldCancel) return false;
      await Promise.all(chunk.map(async (entry) => {
          try {
              // Get partial hash first
              const partialHash = await entry.getPartialHash();
              // Save partial hash immediately (optional, but good for resume)
              updateFileHash(entry.path, partialHash, null);
          } catch (e) {
              logger.error(`Error hashing ${entry.path}:`, e);
          }
      }));
      reportProgress(); // Update UI that we are working
  }

  // 4. Final Grouping by Hash (Partial then Full)
  // This logic is complex, usually we'd do it in steps.
  // For now, let's just ensure we have full hashes for those that match partial hashes.
  
  const byPartialHash = new Map<string, FileEntry[]>();
  for (const entry of potentialDuplicates) {
      const hash = await entry.getPartialHash();
      if (!byPartialHash.has(hash)) byPartialHash.set(hash, []);
      byPartialHash.get(hash)!.push(entry);
  }

  const confirmedDuplicates: FileEntry[] = [];
  for (const [hash, entries] of byPartialHash) {
      if (entries.length > 1) {
          // Collision on partial hash? Check full hash
          // If size is small, partial hash IS full hash, so we are done.
          // If size is large, we need full hash.
          
          // Optimization: If only 2 files and they are small, we are done.
          // But let's be safe and compute full hash for all candidates.
          
          for (const entry of entries) {
              const fullHash = await entry.getFullHash();
              updateFileHash(entry.path, await entry.getPartialHash(), fullHash);
          }
          confirmedDuplicates.push(...entries);
      }
  }

  // 5. Save to DB (only what we need, or everything?)
  // The original code saved everything to DB.
  // If we want to support "Fast Refresh", we should save everything.
  // But for now, let's stick to the original behavior of saving scanned files.
  
  // We need to convert FileEntry back to the format expected by upsertFilesBatch
  // And we should probably save the hashes too if the DB supports it.
  // The current DB schema might need updates.
  
  // For this step, I will just save everything we scanned to maintain compatibility with existing "Results" view
  // But ideally we should update the DB schema to store hashes.
  
  const batch = [];
  for (const [size, entries] of filesBySize) {
      for (const entry of entries) {
          batch.push({
              path: entry.path,
              size: entry.size,
              mtime: entry.mtime,
              // We might want to add hash here if DB supports it
          });
          if (batch.length >= 1000) {
              upsertFilesBatch(batch);
              batch.length = 0;
          }
      }
  }
  if (batch.length > 0) upsertFilesBatch(batch);

  if (!shouldCancel) {
    logger.info(`Scan finished.`)
    mainWindow.webContents.send('scan-complete', { count: scannedCount })
    return true
  } else {
    mainWindow.webContents.send('scan-cancelled')
    return false
  }
}
