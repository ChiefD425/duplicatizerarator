import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Filter } from 'lucide-react'

export interface LogMessage {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  details?: any
}

interface DebugPanelProps {
  logs: LogMessage[]
  onClear: () => void
  onClose: () => void
}

export default function DebugPanel({ logs, onClear, onClose }: DebugPanelProps): JSX.Element {
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const filteredLogs = logs.filter(log => filter === 'all' || log.level === filter)

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>Debug Console</h3>
        <div className="debug-actions">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="debug-filter"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
          <button onClick={onClear} title="Clear Logs" className="icon-btn">
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} title="Close Panel" className="icon-btn">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="debug-content">
        {filteredLogs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.level}`}>
            <span className="log-time">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="log-level">[{log.level.toUpperCase()}]</span>
            <span className="log-message">{log.message}</span>
            {log.details && (
              <pre className="log-details">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
