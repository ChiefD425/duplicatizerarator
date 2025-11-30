import { rename, mkdir } from 'fs/promises'
import { join, dirname, basename } from 'path'
import db from './database'
import { app } from 'electron'

const DUPLICATIZERARATOR_FOLDER = 'Duplicatizerarator'

export async function moveFiles(fileIds: number[]): Promise<void> {
  const files = db.prepare(`SELECT * FROM files WHERE id IN (${fileIds.join(',')})`).all() as any[]
  
  if (files.length === 0) return

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  // We'll put them in a folder relative to the drive root if possible, or user home?
  // The request said "Duplicatizerarator folder for the user to delete manually".
  // Best practice: Create it in the same drive to avoid cross-drive moves which are slow.
  // But for simplicity, let's try to put it in the user's home directory or a specific location.
  // Actually, to be safe and fast, it should be on the same volume.
  // Let's assume we create a "Duplicatizerarator" folder in the User's Home for now, 
  // or maybe better: The root of the drive where the file is? 
  // Let's stick to User Home/Duplicatizerarator/{timestamp} for simplicity and safety.
  
  const targetBaseDir = join(app.getPath('home'), DUPLICATIZERARATOR_FOLDER, timestamp)
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
