import { BrowserWindow } from 'electron'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogMessage {
  timestamp: number
  level: LogLevel
  message: string
  details?: any
}

class Logger {
  private mainWindow: BrowserWindow | null = null

  setWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  private send(level: LogLevel, message: string, details?: any) {
    const log: LogMessage = {
      timestamp: Date.now(),
      level,
      message,
      details
    }
    
    // Console log in main process as well
    console.log(`[${level.toUpperCase()}] ${message}`, details || '')

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('log-message', log)
    }
  }

  info(message: string, details?: any) {
    this.send('info', message, details)
  }

  warn(message: string, details?: any) {
    this.send('warn', message, details)
  }

  error(message: string, details?: any) {
    this.send('error', message, details)
  }
}

export const logger = new Logger()
