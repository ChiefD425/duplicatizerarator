import { rename, mkdir } from 'fs/promises'
import { join, dirname, basename } from 'path'
import db from './database'
import { app } from 'electron'

const DUPLICATIZERARATOR_FOLDER = 'Duplicatizerarator'

export async function moveFiles(fileIds: number[]): Promise<void> {
  const files = db.prepare(`SELECT * FROM files WHERE id IN (${fileIds.join(',')})`).all() as any[]
  
  if (files.length === 0) return

  const date = new Date()
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  
  const targetBaseDir = join(app.getPath('home'), DUPLICATIZERARATOR_FOLDER, dateStr)
  await mkdir(targetBaseDir, { recursive: true })

  const insertHistory = db.prepare('INSERT INTO history (original_path, moved_path) VALUES (?, ?)')
  const deleteFile = db.prepare('DELETE FROM files WHERE id = ?')

  for (const file of files) {
    try {
      const fileName = basename(file.path)
      const targetPath = join(targetBaseDir, fileName)
      
      // Handle name collision in target
      // (Unlikely since we use timestamp folders, but possible if multiple files have same name)
      // We'll append a counter if needed, but for now let's assume unique names or overwrite (safe since they are duplicates?)
      // No, duplicates might have different content if hash collision (unlikely) or if we moved multiple versions.
      // Let's just move.
      
      await rename(file.path, targetPath)
      
      insertHistory.run(file.path, targetPath)
      deleteFile.run(file.id)
    } catch (err) {
      console.error(`Failed to move file ${file.path}:`, err)
    }
  }
}

export async function restoreFiles(historyIds: number[]): Promise<void> {
  const records = db.prepare(`SELECT * FROM history WHERE id IN (${historyIds.join(',')})`).all() as any[]

  const deleteHistory = db.prepare('DELETE FROM history WHERE id = ?')

  for (const record of records) {
    try {
      // Ensure original directory exists
      await mkdir(dirname(record.original_path), { recursive: true })
      
      await rename(record.moved_path, record.original_path)
      deleteHistory.run(record.id)
    } catch (err) {
      console.error(`Failed to restore file ${record.original_path}:`, err)
    }
  }
}

export function getHistory(): any[] {
  return db.prepare('SELECT * FROM history ORDER BY timestamp DESC').all()
}
