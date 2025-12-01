import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import Dashboard from './components/Dashboard'
import Scanning from './components/Scanning'
import Results from './components/Results'
import History from './components/History'
import About from './components/About'
import DebugPanel, { LogMessage } from './components/DebugPanel'
import { History as HistoryIcon, Home, Info, Bug } from 'lucide-react'

function App(): JSX.Element {
  const [view, setView] = useState<'dashboard' | 'scanning' | 'results' | 'history'>('dashboard')
  const [showAbout, setShowAbout] = useState(false)
  const [scanProgress, setScanProgress] = useState({ stage: 'Ready', count: 0, total: 0 })
  const [isScanning, setIsScanning] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [logs, setLogs] = useState<LogMessage[]>([])

  useEffect(() => {
    // Listeners
    window.api.onScanProgress((_e, data) => {
      setScanProgress(prev => ({ ...prev, stage: 'Scanning Files...', count: data.count }))
    })

    window.api.onScanComplete((_e, data) => {
      setScanProgress(prev => ({ ...prev, stage: 'Processing Candidates...', count: data.count }))
    })

    window.api.onProcessingProgress((_e, data) => {
      setScanProgress({ stage: 'Analyzing Duplicates...', count: data.current, total: data.total })
    })
    
    window.api.onHashingProgress((_e, data) => {
      setScanProgress({ stage: 'Verifying Hashes...', count: data.current, total: data.total })
    })

    window.api.onProcessingComplete(() => {
      setIsScanning(false)
      setView('results')
    })

    window.api.onScanCancelled(() => {
      setIsScanning(false)
      setScanProgress({ stage: 'Ready', count: 0, total: 0 })
      setView('dashboard')
    })

    window.api.onLogMessage((_e, log) => {
      setLogs(prev => [...prev, log])
    })

    return () => {
      window.api.removeListener('scan-progress')
      window.api.removeListener('scan-complete')
      window.api.removeListener('processing-progress')
      window.api.removeListener('hashing-progress')
      window.api.removeListener('processing-complete')
      window.api.removeListener('scan-cancelled')
      window.api.removeListener('log-message')
    }
  }, [])

  const startScan = (options: any) => {
    setIsScanning(true)
    setView('scanning')
    setScanProgress({ stage: 'Starting...', count: 0, total: 0 })
    window.api.startScan(options)
  }

  const cancelScan = async () => {
    await window.api.cancelScan()
    // State update handled by onScanCancelled listener
  }

  const handleMove = async (ids: number[]) => {
    await window.api.moveFiles(ids)
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <button 
          className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`} 
          onClick={() => setView('dashboard')} 
          title="Home"
        >
          <Home size={22} />
        </button>
        {isScanning && (
          <button 
            className={`nav-btn pulse ${view === 'scanning' ? 'active' : ''}`} 
            onClick={() => setView('scanning')} 
            title="Current Scan"
          >
            <div className="scanner-icon-small">🔍</div>
          </button>
        )}
        <button 
          className={`nav-btn ${view === 'history' ? 'active' : ''}`} 
          onClick={() => setView('history')} 
          title="History"
        >
          <HistoryIcon size={22} />
        </button>
        <div style={{ flex: 1 }} /> {/* Spacer */}
        <button 
          className="nav-btn" 
          onClick={() => setShowAbout(true)} 
          title="About"
        >
          <Info size={22} />
        </button>
        <button 
          className={`nav-btn ${showDebug ? 'active' : ''}`} 
          onClick={() => setShowDebug(!showDebug)} 
          title="Debug Console"
        >
          <Bug size={22} />
        </button>
      </aside>
      
      <main className="main-content">
        <div className="view-container">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <Dashboard key="dashboard" onStartScan={startScan} />}
            {view === 'scanning' && <Scanning key="scanning" progress={scanProgress} onCancel={cancelScan} />}
            {view === 'results' && <Results key="results" onMove={handleMove} />}
            {view === 'history' && <History key="history" />}
          </AnimatePresence>

          <AnimatePresence>
            {showAbout && <About key="about" onClose={() => setShowAbout(false)} />}
          </AnimatePresence>
        </div>

        {showDebug && (
          <DebugPanel 
            logs={logs} 
            onClear={() => setLogs([])} 
            onClose={() => setShowDebug(false)} 
          />
        )}
      </main>
    </div>
  )
}

export default App
