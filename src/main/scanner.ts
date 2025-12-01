import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { upsertFilesBatch, clearFiles, getAllFilesMap, deleteFiles, getExcludedFolders } from './database'
import { BrowserWindow } from 'electron'
import { logger } from './logger'
import { FileEntry } from './fileEntry'

// Smart Exclusions
const DEFAULT_EXCLUSIONS = [
  'Windows',
  'Program Files',
  'Program Files (x86)',
  'node_modules',
  '.git',
  'AppData',
  '$Recycle.Bin',
  '$RECYCLE.BIN',
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

  // Load excluded folders
  const excludedFolders = getExcludedFolders()

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
        // Check dynamic exclusions
        if (excludedFolders.some(ex => dir.startsWith(ex))) continue

        // Check for dot folders (hidden folders)
        const dirName = dir.split(/[/\\]/).pop()
        if (dirName && dirName.startsWith('.') && dirName !== '.') continue

        const dirents = await readdir(dir, { withFileTypes: true })
        for (const dirent of dirents) {
            const path = join(dir, dirent.name)
            
            if (options.ignoreSystem && DEFAULT_EXCLUSIONS.some(ex => path.toLowerCase().includes(ex.toLowerCase()))) continue
            
            // Check dynamic exclusions for files/subfolders
            if (excludedFolders.some(ex => path.startsWith(ex))) continue

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

  // 3. Save to DB
  // We save everything we scanned. The processor will handle hashing and duplicate detection.
  
  const batch = [];
  for (const [size, entries] of filesBySize) {
      for (const entry of entries) {
          batch.push({
              path: entry.path,
              size: entry.size,
              mtime: entry.mtime,
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
