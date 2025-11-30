import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { HardDrive, Music, Video, Image, FileText, Play } from 'lucide-react'

interface DashboardProps {
  onStartScan: (options: any) => void
}

export default function Dashboard({ onStartScan }: DashboardProps): JSX.Element {
  const [drives, setDrives] = useState<{ path: string; label: string }[]>([])
  const [selectedDrives, setSelectedDrives] = useState<string[]>([])
  const [fileTypes, setFileTypes] = useState<string[]>(['photos', 'music', 'videos', 'documents'])
  const [forceRefresh, setForceRefresh] = useState(false)

  useEffect(() => {
    window.api.getDrives().then((ds) => {
      setDrives(ds)
      // Select all by default
      setSelectedDrives(ds.map((d) => d.path))
    })
  }, [])

  const toggleDrive = (path: string) => {
    setSelectedDrives((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const toggleType = (type: string) => {
    setFileTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleScan = () => {
    if (selectedDrives.length === 0) return
    onStartScan({
      paths: selectedDrives,
      types: fileTypes,
      ignoreSystem: true,
      forceRefresh
    })
  }

  return (
    <motion.div 
      className="dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="hero">
        <motion.h1
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Duplicatizerarator
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Reclaim your space with style.
        </motion.p>
      </header>

      <div className="config-grid">
        <motion.div 
          className="card glass"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3><HardDrive size={20} /> Select Drives</h3>
          <div className="drive-list">
            {drives.map((drive) => (
              <div 
                key={drive.path} 
                className={`drive-item ${selectedDrives.includes(drive.path) ? 'selected' : ''}`}
                onClick={() => toggleDrive(drive.path)}
              >
                <div className="drive-icon">💾</div>
                <div className="drive-info">
                  <span className="drive-label">{drive.label}</span>
                  <span className="drive-path">{drive.path}</span>
                </div>
                <div className="checkbox"></div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          className="card glass"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3>Scan For</h3>
          <div className="type-grid">
            <div 
              className={`type-item ${fileTypes.includes('photos') ? 'selected' : ''}`}
              onClick={() => toggleType('photos')}
            >
              <Image size={24} />
              <span>Photos</span>
            </div>
            <div 
              className={`type-item ${fileTypes.includes('music') ? 'selected' : ''}`}
              onClick={() => toggleType('music')}
            >
              <Music size={24} />
              <span>Music</span>
            </div>
            <div 
              className={`type-item ${fileTypes.includes('videos') ? 'selected' : ''}`}
              onClick={() => toggleType('videos')}
            >
              <Video size={24} />
              <span>Videos</span>
            </div>
            <div 
              className={`type-item ${fileTypes.includes('documents') ? 'selected' : ''}`}
              onClick={() => toggleType('documents')}
            >
              <FileText size={24} />
              <span>Docs</span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div 
        className="action-area"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="scan-options">
          <label className="checkbox-container">
            <input 
              type="checkbox" 
              checked={forceRefresh} 
              onChange={(e) => setForceRefresh(e.target.checked)} 
            />
            <span className="checkmark"></span>
            Force Refresh Index
          </label>
        </div>
        <button 
          className="scan-btn" 
          onClick={handleScan}
          disabled={selectedDrives.length === 0}
        >
          <Play fill="currentColor" /> START SCAN
        </button>
      </motion.div>
    </motion.div>
  )
}
