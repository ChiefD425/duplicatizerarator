import React, { useState, useEffect } from 'react'
import { Trash2, Plus, FolderOpen } from 'lucide-react'
import { motion } from 'framer-motion'

interface SettingsProps {
  onClose: () => void
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [excludedFolders, setExcludedFolders] = useState<string[]>([])
  const [newPath, setNewPath] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExclusions()
  }, [])

  const loadExclusions = async () => {
    try {
      const folders = await window.api.getExcludedFolders()
      setExcludedFolders(folders)
    } catch (err) {
      console.error('Failed to load exclusions:', err)
    }
  }

  const handleAdd = async () => {
    if (!newPath) return
    
    // Basic validation
    if (excludedFolders.includes(newPath)) {
      setError('Folder is already excluded')
      return
    }

    try {
      const result = await window.api.addExcludedFolder(newPath)
      if (result.success) {
        setNewPath('')
        setError(null)
        loadExclusions()
      } else {
        setError(result.error || 'Failed to add exclusion')
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRemove = async (path: string) => {
    try {
      const result = await window.api.removeExcludedFolder(path)
      if (result.success) {
        loadExclusions()
      } else {
        console.error('Failed to remove exclusion:', result.error)
      }
    } catch (err) {
      console.error('Failed to remove exclusion:', err)
    }
  }

  return (
    <motion.div 
      className="settings-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="settings-modal">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="settings-content">
          <h3>Excluded Folders</h3>
          <p className="settings-desc">
            These folders will be ignored during scans. Existing files from these folders will be removed from the database.
          </p>

          <div className="add-exclusion-form">
            <input 
              type="text" 
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="Enter folder path to exclude..."
              className="exclusion-input"
            />
            <button className="add-btn" onClick={handleAdd} disabled={!newPath}>
              <Plus size={18} />
              Add
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}

          <div className="exclusions-list">
            {excludedFolders.length === 0 ? (
              <div className="empty-state">No excluded folders</div>
            ) : (
              excludedFolders.map((path) => (
                <div key={path} className="exclusion-item">
                  <FolderOpen size={16} className="folder-icon" />
                  <span className="path-text">{path}</span>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemove(path)}
                    title="Remove exclusion"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Settings
