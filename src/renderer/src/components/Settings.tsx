import React, { useState, useEffect } from 'react'
import { Trash2, Plus, FolderOpen, Shield, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

const Settings: React.FC = () => {
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
      className="view-content settings-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="view-header">
        <h1>Settings</h1>
        <p className="subtitle">Manage application preferences and exclusions</p>
      </div>

      <div className="settings-section">
        <div className="section-header">
          <Shield className="section-icon" size={24} />
          <div>
            <h2>Excluded Folders</h2>
            <p>Manage folders that should be ignored during scans. Files in these folders will not be indexed.</p>
          </div>
        </div>

        <div className="card">
          <div className="add-exclusion-row">
            <div className="input-group">
              <FolderOpen size={20} className="input-icon" />
              <input 
                type="text" 
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="Enter absolute folder path to exclude (e.g. C:\Windows)"
                className="premium-input"
              />
            </div>
            <button className="btn-primary" onClick={handleAdd} disabled={!newPath}>
              <Plus size={18} />
              <span>Add Exclusion</span>
            </button>
          </div>
          
          {error && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="exclusions-list-container">
            {excludedFolders.length === 0 ? (
              <div className="empty-state-small">
                <p>No excluded folders configured</p>
              </div>
            ) : (
              <div className="exclusions-grid">
                {excludedFolders.map((path) => (
                  <div key={path} className="exclusion-card">
                    <div className="exclusion-info">
                      <FolderOpen size={18} className="folder-icon" />
                      <span className="path-text" title={path}>{path}</span>
                    </div>
                    <button 
                      className="btn-icon-danger"
                      onClick={() => handleRemove(path)}
                      title="Remove exclusion"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Settings
