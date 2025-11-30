import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface Drive {
  path: string
  label: string
}

export async function getDrives(): Promise<Drive[]> {
  try {
    const { stdout } = await execAsync('wmic logicaldisk get name,volumename')
    const lines = stdout.trim().split('\n').slice(1)
    
    return lines
      .map(line => {
        const parts = line.trim().split(/\s+/)
        const path = parts[0]
        // Volume name might be empty or contain spaces, so we grab the rest
        const label = parts.slice(1).join(' ') || 'Local Disk'
        
        return { path: path + '\\', label }
      })
      .filter(drive => drive.path)
  } catch (error) {
    console.error('Failed to get drives:', error)
    return [{ path: 'C:\\', label: 'Local Disk' }]
  }
}
