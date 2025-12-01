import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { HardDrive, Music, Video, Image, FileText, Play, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import clsx from 'clsx'

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
      <header className="hero text-center mb-12 mt-8">
        <motion.h1
          className="text-5xl font-bold mb-4 text-gradient"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Duplicatizerarator
        </motion.h1>
        <motion.p
          className="text-xl text-gray-400"
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
                className={clsx('drive-item', selectedDrives.includes(drive.path) && 'selected')}
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
            {[
              { id: 'photos', icon: <Image size={24} />, label: 'Photos' },
              { id: 'music', icon: <Music size={24} />, label: 'Music' },
              { id: 'videos', icon: <Video size={24} />, label: 'Videos' },
              { id: 'documents', icon: <FileText size={24} />, label: 'Docs' }
            ].map((type) => (
              <div 
                key={type.id}
                className={clsx('type-item', fileTypes.includes(type.id) && 'selected')}
                onClick={() => toggleType(type.id)}
              >
                {type.icon}
                <span>{type.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div 
        className="action-area flex flex-col items-center gap-6"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div 
          className="flex items-center gap-3 cursor-pointer text-gray-400 hover:text-white transition-colors"
          onClick={() => setForceRefresh(!forceRefresh)}
        >
          <div className={clsx("w-5 h-5 border-2 rounded flex items-center justify-center transition-colors", forceRefresh ? "border-accent-primary bg-accent-primary" : "border-gray-600")}>
            {forceRefresh && <RefreshCw size={12} className="text-white" />}
          </div>
          <span>Force Refresh Index</span>
        </div>

        <Button 
          variant="primary" 
          onClick={handleScan}
          disabled={selectedDrives.length === 0}
          className="px-12 py-4 text-lg rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
          icon={<Play fill="currentColor" />}
        >
          START SCAN
        </Button>
      </motion.div>
    </motion.div>
  )
}
