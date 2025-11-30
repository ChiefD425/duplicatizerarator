import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, File } from 'lucide-react'
import '../assets/history.css'

export default function History(): JSX.Element {
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    const data = await window.api.getHistory()
    setHistory(data)
  }

  const handleRestore = async (id: number) => {
    await window.api.restoreFiles([id])
    loadHistory()
  }

  return (
    <motion.div 
      className="history-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <h2>Operation History</h2>
      
      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item card glass">
            <div className="history-info">
              <div className="history-path original">
                <span className="label">Original:</span>
                <span className="path" title={item.original_path}>{item.original_path}</span>
              </div>
              <div className="history-arrow">↓</div>
              <div className="history-path moved">
                <span className="label">Moved to:</span>
                <span className="path" title={item.moved_path}>{item.moved_path}</span>
              </div>
              <div className="history-date">
                {new Date(item.timestamp).toLocaleString()}
              </div>
            </div>
            <button 
              className="restore-btn"
              onClick={() => handleRestore(item.id)}
            >
              <RotateCcw size={16} /> Restore
            </button>
          </div>
        ))}
        {history.length === 0 && (
          <div className="empty-state">
            <p>No history yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
