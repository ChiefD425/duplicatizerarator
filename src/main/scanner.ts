import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { upsertFilesBatch, clearFiles, getAllFilesMap, deleteFiles } from './database'
import { BrowserWindow } from 'electron'
import { logger } from './logger'

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
  let newOrChangedCount = 0
  
  // Batching
  let fileBatch: { path: string, size: number, mtime: number }[] = []
  const BATCH_SIZE = 1000
  let lastReportTime = Date.now()

  const flushBatch = () => {
    if (fileBatch.length > 0) {
      upsertFilesBatch(fileBatch)
      newOrChangedCount += fileBatch.length
      fileBatch = []
    }
  }

  // Concurrency Control
  const MAX_CONCURRENCY = 32 // Adjust based on system limits
  let activeOperations = 0
  const queue: string[] = [...options.paths]
  
  // Promise to signal completion
  let resolveScan: (value: boolean) => void
  const scanPromise = new Promise<boolean>((resolve) => { resolveScan = resolve })

  const processQueue = async () => {
    while (queue.length > 0 || activeOperations > 0) {
      if (shouldCancel) {
        flushBatch()
        resolveScan(false)
        return
      }

      // If queue is empty but operations are active, wait a bit
      if (queue.length === 0) {
        await new Promise(r => setTimeout(r, 10))
        continue
      }

      // If max concurrency reached, wait
      if (activeOperations >= MAX_CONCURRENCY) {
        await new Promise(r => setTimeout(r, 5))
        continue
      }

      const dir = queue.shift()
      if (!dir) continue

      activeOperations++
      
      // Process directory in background (don't await here to allow parallelism)
      processDirectory(dir).finally(() => {
        activeOperations--
      })
    }
    
    // Done
    flushBatch()
    resolveScan(true)
  }

  const processDirectory = async (dir: string) => {
    if (shouldCancel) return

    try {
      // CRITICAL OPTIMIZATION: withFileTypes: true avoids extra stat calls for directories
      const dirents = await readdir(dir, { withFileTypes: true })
      
      for (const dirent of dirents) {
        if (shouldCancel) return

        const path = join(dir, dirent.name)

        // Check Exclusions
        if (options.ignoreSystem && DEFAULT_EXCLUSIONS.some(ex => path.includes(ex))) {
          continue
        }

        if (dirent.isDirectory()) {
          queue.push(path)
        } else if (dirent.isFile()) {
          const ext = extname(path).toLowerCase()
          if (allowedExtensions.size === 0 || allowedExtensions.has(ext)) {
            
            // Only stat if extension matches
            try {
              const stats = await stat(path)
              
              const existing = existingFiles.get(path)
              const isUnchanged = existing && existing.size === stats.size && existing.mtime === stats.mtimeMs
              
              if (!isUnchanged) {
                fileBatch.push({ path, size: stats.size, mtime: stats.mtimeMs })
                if (fileBatch.length >= BATCH_SIZE) {
                  flushBatch()
                }
              }
              
              seenPaths.add(path)
              scannedCount++
              
              // Report progress periodically (time-based to avoid UI spam)
              const now = Date.now()
              if (now - lastReportTime > 200) { // Every 200ms
                 mainWindow.webContents.send('scan-progress', { count: scannedCount })
                 lastReportTime = now
              }
            } catch (err) {
              // Ignore stat errors (permission denied, etc)
            }
          }
        }
      }
    } catch (err) {
      // Ignore readdir errors (permission denied, etc)
    }
  }

  // Start the processor loop
  // We wrap it in a try-catch to ensure we catch any top-level errors
  try {
    await processQueue()
  } catch (err) {
    logger.error('Scan error:', err)
  }

  // Cleanup deleted files
  if (!shouldCancel && !options.forceRefresh) {
    const pathsToDelete: string[] = []
    for (const [path] of existingFiles) {
      if (!seenPaths.has(path)) {
        if (options.paths.some(root => path.startsWith(root))) {
          pathsToDelete.push(path)
        }
      }
    }
    
    if (pathsToDelete.length > 0) {
      logger.info(`Removing ${pathsToDelete.length} deleted files from index...`)
      deleteFiles(pathsToDelete)
    }
  }
  
  if (!shouldCancel) {
    logger.info(`Scan finished. Total files: ${scannedCount}, New/Changed: ${newOrChangedCount}`)
    mainWindow.webContents.send('scan-complete', { count: scannedCount })
    return true
  } else {
    logger.warn('Scan cancelled by user')
    mainWindow.webContents.send('scan-cancelled')
    return false
  }
}
