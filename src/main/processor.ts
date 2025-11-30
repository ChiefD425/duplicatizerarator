import db from './database'
import { calculatePartialHash, calculateFullHash } from './hasher'
import { BrowserWindow } from 'electron'
import { logger } from './logger'

export async function processDuplicates(mainWindow: BrowserWindow): Promise<void> {
  // 1. Find files with same size (potential duplicates)
  // We only care if there are > 1 files with same size.
  const sizeCandidatesCount = db.prepare(`
    SELECT COUNT(*) as count FROM files 
    WHERE size IN (
      SELECT size FROM files 
      GROUP BY size 
      HAVING COUNT(*) > 1
    )
  `).get() as { count: number }

  if (sizeCandidatesCount.count === 0) {
    logger.info('No files with same size found. Skipping processing.')
    mainWindow.webContents.send('scan-complete', { count: 0 })
    return
  }

  // 2. Calculate Partial Hashes for candidates that don't have one
  const partialCandidates = db.prepare(`
    SELECT path, size, id FROM files 
    WHERE size IN (
      SELECT size FROM files 
      GROUP BY size 
      HAVING COUNT(*) > 1
    ) AND partial_hash IS NULL
  `).all() as { path: string, size: number, id: number }[]

  if (partialCandidates.length > 0) {
    logger.info(`Found ${partialCandidates.length} new candidates needing partial hash.`)
    
    const updatePartialHashStmt = db.prepare('UPDATE files SET partial_hash = ? WHERE id = ?')
    
    mainWindow.webContents.send('processing-progress', { current: 0, total: partialCandidates.length })

    // Batching buffer
    let buffer: { id: number, hash: string }[] = []
    const flushBuffer = () => {
      if (buffer.length === 0) return
      const updateMany = db.transaction((items: { id: number, hash: string }[]) => {
        for (const item of items) updatePartialHashStmt.run(item.hash, item.id)
      })
      updateMany(buffer)
      buffer = []
    }

    await processQueue(
      partialCandidates,
      2, // Lower concurrency to keep UI responsive
      async (file) => {
        return await calculatePartialHash(file.path, file.size)
      },
      (file, result) => {
        buffer.push({ id: file.id, hash: result })
        if (buffer.length >= 100) flushBuffer()
      },
      (processed, total) => {
        // Update UI more frequently
        if (processed % 5 === 0 || processed === total) {
          mainWindow.webContents.send('processing-progress', { current: processed, total })
        }
      }
    )
    // Flush remaining
    flushBuffer()
  }

  // 3. Find files with same Partial Hash
  // We need to calculate full hash for ANY file that shares a partial hash with another file.
  // And we only need to calculate it if it's currently NULL.
  const fullCandidates = db.prepare(`
    SELECT path, size, id FROM files 
    WHERE partial_hash IN (
      SELECT partial_hash FROM files 
      WHERE partial_hash IS NOT NULL
      GROUP BY partial_hash 
      HAVING COUNT(*) > 1
    ) AND full_hash IS NULL
  `).all() as { path: string, size: number, id: number }[]

  if (fullCandidates.length > 0) {
    logger.info(`Found ${fullCandidates.length} candidates needing full hash.`)
    
    const updateFullHashStmt = db.prepare('UPDATE files SET full_hash = ? WHERE id = ?')
    
    mainWindow.webContents.send('hashing-progress', { current: 0, total: fullCandidates.length })

    // Batching buffer
    let buffer: { id: number, hash: string }[] = []
    const flushBuffer = () => {
      if (buffer.length === 0) return
      const updateMany = db.transaction((items: { id: number, hash: string }[]) => {
        for (const item of items) updateFullHashStmt.run(item.hash, item.id)
      })
      updateMany(buffer)
      buffer = []
    }

    await processQueue(
      fullCandidates,
      2, // Lower concurrency
      async (file) => {
        return await calculateFullHash(file.path)
      },
      (file, result) => {
        buffer.push({ id: file.id, hash: result })
        if (buffer.length >= 100) flushBuffer()
      },
      (processed, total) => {
        mainWindow.webContents.send('hashing-progress', { current: processed, total })
      }
    )
    // Flush remaining
    flushBuffer()
  }

  // Done
  logger.info('Processing complete.')
  mainWindow.webContents.send('processing-complete')
}

// Helper for parallel processing
async function processQueue<T, R>(
  items: T[],
  concurrency: number,
  taskFn: (item: T) => Promise<R>,
  onResult: (item: T, result: R) => void,
  onProgress: (processed: number, total: number) => void
): Promise<void> {
  let index = 0
  let processed = 0
  const total = items.length

  const workers = Array(Math.min(concurrency, total)).fill(null).map(async () => {
    while (index < total) {
      const i = index++ // Atomic increment
      if (i >= total) break
      
      const item = items[i]
      try {
        const result = await taskFn(item)
        onResult(item, result)
      } catch (err) {
        // Ignore errors, just count as processed
        console.error(err)
      }
      
      processed++
      onProgress(processed, total)

      // Yield to event loop every few items to keep UI responsive
      if (processed % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    }
  })

  await Promise.all(workers)
}
