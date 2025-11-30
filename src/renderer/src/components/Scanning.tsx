import { motion } from 'framer-motion'

interface ScanningProps {
  progress: {
    stage: string
    count: number
    total?: number
  }
  onCancel: () => void
}

export default function Scanning({ progress, onCancel }: ScanningProps): JSX.Element {
  return (
    <motion.div 
      className="scanning-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="scanner-visual">
        <motion.div 
          className="scanner-ring"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        <div className="scanner-icon">🔍</div>
      </div>
      
      <h2>{progress.stage}</h2>
      
      <div className="stats">
        <div className="stat-item">
          <span className="label">{progress.stage.includes('Scanning') ? 'Found' : 'Processed'}</span>
          <span className="value">{progress.count}</span>
        </div>
        {!!progress.total && progress.total > 0 && (
          <>
            <div className="stat-item">
              <span className="label">Total</span>
              <span className="value">{progress.total}</span>
            </div>
            <div className="stat-item">
              <span className="label">Progress</span>
              <span className="value">
                {Math.round((progress.count / progress.total) * 100)}%
              </span>
            </div>
          </>
        )}
      </div>

      <button className="cancel-btn" onClick={onCancel}>
        Cancel Scan
      </button>
    </motion.div>
  )
}
