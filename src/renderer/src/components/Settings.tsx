import React, { useState, useEffect } from 'react'
import { Trash2, Plus, FolderOpen, Shield, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

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
      <div className="view-header mb-8">
        <h1 className="text-3xl font-bold text-gradient mb-2">Settings</h1>
        <p className="text-gray-400">Manage application preferences and exclusions</p>
      </div>

      <div className="settings-section max-w-3xl">
        <div className="section-header flex gap-4 mb-6">
          <div className="p-2 bg-gray-800 rounded-lg h-fit">
            <Shield className="text-accent-primary" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-1">Excluded Folders</h2>
            <p className="text-gray-400 text-sm">Manage folders that should be ignored during scans. Files in these folders will not be indexed.</p>
          </div>
        </div>

        <div className="card glass p-6 rounded-xl">
          <div className="flex gap-4 mb-6 items-end">
            <div className="flex-1">
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="Enter absolute folder path (e.g. C:\Windows)"
                icon={<FolderOpen size={18} />}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} disabled={!newPath} icon={<Plus size={18} />}>
              Add
            </Button>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg flex items-center gap-2 mb-4 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-bg-tertiary rounded-lg p-4 min-h-[100px]">
            {excludedFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                <FolderOpen size={32} className="mb-2 opacity-50" />
                <p>No excluded folders configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {excludedFolders.map((path) => (
                  <div key={path} className="bg-bg-secondary border border-border-color rounded-lg p-3 flex items-center justify-between group hover:border-gray-500 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FolderOpen size={16} className="text-accent-secondary flex-shrink-0" />
                      <span className="text-sm text-gray-300 truncate" title={path}>{path}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 h-auto"
                      onClick={() => handleRemove(path)}
                      title="Remove exclusion"
                    >
                      <Trash2 size={16} />
                    </Button>
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
