
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { File, Image, Music, Video, Trash2, Eye, Check, Search, Filter as FilterIcon, ChevronLeft, ChevronRight, FolderOpen, FileText, Presentation, Folder } from 'lucide-react'
import '../assets/results.css'

interface ResultsProps {
  onMove: (ids: number[]) => void
}

export default function Results({ onMove }: ResultsProps): JSX.Element {
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [duplicateFolders, setDuplicateFolders] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'files' | 'folders'>('files')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<string[]>([])
  const [previewFiles, setPreviewFiles] = useState<any[]>([])
  
  // Filter States
  const [search, setSearch] = useState('')
  const [minSize, setMinSize] = useState(0)
  const [page, setPage] = useState(0)
  const limit = 20

  const loadDuplicates = async () => {
    const dups = await window.api.getDuplicates({
      search,
      minSize,
      limit,
      offset: page * limit
    })

    // Group by hash
    const grouped: any[] = []
    const map = new Map()
    
    dups.forEach((d: any) => {
      if (!map.has(d.hash)) {
        map.set(d.hash, [])
      }
      map.get(d.hash).push(d)
    })
    
    map.forEach((group) => {
      if (group.length > 1) {
        grouped.push(group)
      }
    })
    
    setDuplicates(grouped)
  }

  const loadDuplicateFolders = async () => {
    const folders = await window.api.getDuplicateFolders()
    setDuplicateFolders(folders)
  }

  useEffect(() => {
    if (viewMode === 'files') {
      const timer = setTimeout(() => {
        setPage(0) // Reset to page 0 on filter change
        loadDuplicates()
      }, 300)
      return () => clearTimeout(timer)
    } else {
      loadDuplicateFolders()
    }
  }, [search, minSize, viewMode])

  useEffect(() => {
    loadDuplicates()
  }, [page])

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const newSelection = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      
      // Update preview files based on selection
      // Find the group that contains this file
      const group = duplicates.find((g: any[]) => g.some((f: any) => f.id === id))
      if (group) {
        const selectedInGroup = group.filter((f: any) => newSelection.includes(f.id))
        setPreviewFiles(selectedInGroup)
      }
      
      return newSelection
    })
  }

  const toggleFolderSelect = (path: string) => {
    setSelectedFolderPaths(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path])
  }

  const handleMove = async () => {
    if (viewMode === 'files') {
      if (selectedIds.length === 0) return
      await onMove(selectedIds)
      loadDuplicates()
      setSelectedIds([])
    } else {
      if (selectedFolderPaths.length === 0) return
      // For folders, we need to get all file IDs in these folders
      // Since we don't have a direct "delete folder" API yet, we'll just delete the files we know about
      // Or we can implement a deleteFolder API. For now let's collect IDs from the loaded data.
      
      const idsToDelete: number[] = []
      duplicateFolders.forEach(group => {
        group.forEach((folder: any) => {
          if (selectedFolderPaths.includes(folder.path)) {
            folder.files.forEach((f: any) => idsToDelete.push(f.id))
          }
        })
      })
      
      if (idsToDelete.length > 0) {
        await onMove(idsToDelete)
        loadDuplicateFolders()
        setSelectedFolderPaths([])
      }
    }
  }

  const handleShowInFolder = async (path: string) => {
    await window.api.showItemInFolder(path)
  }

  const autoSelect = (criteria: 'newest' | 'oldest' | 'shortest') => {
    const newSelected: number[] = []
    
    duplicates.forEach(group => {
      let keepId = -1
      
      // Find the one to keep based on criteria
      if (criteria === 'newest') {
        // Keep the one with largest created_at/mtime (assuming created_at is date string)
        // Note: DB returns created_at as string, but we might want mtime if available.
        // For now using created_at as proxy or mtime if we had it.
        // Let's assume we want to sort by ID if dates are equal (stable sort)
        const sorted = [...group].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        keepId = sorted[0].id
      } else if (criteria === 'oldest') {
        const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        keepId = sorted[0].id
      } else if (criteria === 'shortest') {
        const sorted = [...group].sort((a, b) => a.path.length - b.path.length)
        keepId = sorted[0].id
      }
      
      // Select all others
      group.forEach((f: any) => {
        if (f.id !== keepId) newSelected.push(f.id)
      })
    })
    
    setSelectedIds(newSelected)
  }

  const getIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    if (['jpg', 'png', 'gif', 'webp', 'jpeg', 'bmp'].includes(ext || '')) return <Image size={16} />
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext || '')) return <Music size={16} />
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')) return <Video size={16} />
    if (['pdf'].includes(ext || '')) return <FileText size={16} />
    if (['ppt', 'pptx'].includes(ext || '')) return <Presentation size={16} />
    return <File size={16} />
  }

  const [previewSrcs, setPreviewSrcs] = useState<Map<string, string>>(new Map())
  const [previewErrors, setPreviewErrors] = useState<Set<string>>(new Set())
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (previewFiles.length === 0) {
      setPreviewSrcs(new Map())
      setPreviewErrors(new Set())
      return
    }

    const loadPreviews = async () => {
      const newSrcs = new Map(previewSrcs)
      const newErrors = new Set(previewErrors)
      const newLoading = new Set(loadingPreviews)

      for (const file of previewFiles) {
        if (newSrcs.has(file.path) || newErrors.has(file.path) || newLoading.has(file.path)) continue

        newLoading.add(file.path)
        setLoadingPreviews(new Set(newLoading))

        try {
          const ext = file.path.split('.').pop()?.toLowerCase()
          if (['jpg', 'png', 'gif', 'webp', 'jpeg', 'bmp'].includes(ext || '')) {
            const src = await window.api.getFilePreview(file.path)
            if (src) {
              newSrcs.set(file.path, src)
            } else {
              newErrors.add(file.path)
            }
          } else if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'pdf'].includes(ext || '')) {
             // These can be loaded directly via media protocol or file protocol if supported
             // We'll use the media protocol we saw in main/index.ts: protocol.registerFileProtocol('media', ...)
             // So we can just set the src to media://<path>
             // We use query params to avoid issues with path parsing
             const mediaUrl = `media://open?path=${encodeURIComponent(file.path)}`
             newSrcs.set(file.path, mediaUrl)
          } else {
            // Not supported for direct preview (like PPTX), we will handle in render
          }
        } catch (err) {
          console.error('Error loading preview:', err)
          newErrors.add(file.path)
        } finally {
          newLoading.delete(file.path)
        }
      }
      
      setPreviewSrcs(new Map(newSrcs))
      setPreviewErrors(new Set(newErrors))
      setLoadingPreviews(new Set(newLoading))
    }

    loadPreviews()
  }, [previewFiles])

  return (
    <motion.div 
      className="results-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="results-header">
        <div className="header-top">
          <h2>Duplicates Found</h2>
          <div className="view-toggle" style={{ marginLeft: '20px', display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: '8px' }}>
            <button 
              className={`toggle-btn ${viewMode === 'files' ? 'active' : ''}`}
              onClick={() => setViewMode('files')}
              style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'files' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', cursor: 'pointer' }}
            >
              Files
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'folders' ? 'active' : ''}`}
              onClick={() => setViewMode('folders')}
              style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'folders' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', cursor: 'pointer' }}
            >
              Folders
            </button>
          </div>
          <div className="actions">
            <span>{viewMode === 'files' ? selectedIds.length : selectedFolderPaths.length} selected</span>
            <button 
              className="move-btn"
              disabled={selectedIds.length === 0}
              onClick={handleMove}
            >
              <Trash2 size={16} /> Move
            </button>
          </div>
          <div className="selection-tools">
            <button className="tool-btn" onClick={() => autoSelect('newest')}>Keep Newest</button>
            <button className="tool-btn" onClick={() => autoSelect('oldest')}>Keep Oldest</button>
            <button className="tool-btn" onClick={() => autoSelect('shortest')}>Keep Shortest Name</button>
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search files..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="filter-box">
            <FilterIcon size={16} />
            <select 
              value={minSize} 
              onChange={(e) => setMinSize(Number(e.target.value))}
            >
              <option value={0}>Any Size</option>
              <option value={500 * 1024}>&gt; 500 KB</option>
              <option value={1024 * 1024}>&gt; 1 MB</option>
              <option value={5 * 1024 * 1024}>&gt; 5 MB</option>
              <option value={100 * 1024 * 1024}>&gt; 100 MB</option>
            </select>
          </div>

          {viewMode === 'files' && (
            <div className="pagination">
              <button 
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>Page {page + 1}</span>
              <button 
                disabled={duplicates.length < limit}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="results-content">
        <div className="list-view">
          {viewMode === 'files' && duplicates.map((group, idx) => (
            <div key={idx} className="duplicate-group card glass">
              <div className="group-header">
                <span 
                  className="hash-tag clickable" 
                  onClick={() => setPreviewFiles(group)}
                  title="Click to preview all files in this group"
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Group #{page * limit + idx + 1}
                </span>
                <span className="size-tag">{(group[0].size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {group.map((file: any) => (
                <div 
                  key={file.id} 
                  className={`file-row ${selectedIds.includes(file.id) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(file.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleShowInFolder(file.path)
                  }}
                  title="Right-click to show in folder"
                >
                  <div className="checkbox">
                    {selectedIds.includes(file.id) && <Check size={12} />}
                  </div>
                  <div className="file-icon">{getIcon(file.path)}</div>
                  <div className="file-details">
                    <div className="file-name">{file.path.split('\\').pop()}</div>
                    <div className="file-path">{file.path}</div>
                  </div>
                  <button 
                    className="preview-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewFiles([file])
                    }}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          
          {viewMode === 'folders' && duplicateFolders.map((group, idx) => (
            <div key={idx} className="duplicate-group card glass">
              <div className="group-header">
                <span className="hash-tag">Folder Group #{idx + 1}</span>
                <span className="size-tag">{(group[0].size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {group.map((folder: any) => (
                <div 
                  key={folder.path} 
                  className={`file-row ${selectedFolderPaths.includes(folder.path) ? 'selected' : ''}`}
                  onClick={() => toggleFolderSelect(folder.path)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleShowInFolder(folder.path)
                  }}
                  title="Right-click to show in folder"
                >
                  <div className="checkbox">
                    {selectedFolderPaths.includes(folder.path) && <Check size={12} />}
                  </div>
                  <div className="file-icon"><Folder size={16} /></div>
                  <div className="file-details">
                    <div className="file-name">{folder.path.split(/[/\\]/).pop()}</div>
                    <div className="file-path">{folder.path}</div>
                    <div className="file-meta-small" style={{ fontSize: '0.8em', opacity: 0.7 }}>
                      {folder.fileCount} files
                    </div>
                  </div>
                  <button 
                    className="preview-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShowInFolder(folder.path)
                    }}
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {duplicates.length === 0 && viewMode === 'files' && (
            <div className="empty-state">
              <h3>No duplicates found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
          {duplicateFolders.length === 0 && viewMode === 'folders' && (
            <div className="empty-state">
              <h3>No duplicate folders found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {previewFiles.length > 0 && (
            <motion.div 
              className="preview-pane glass"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              key="preview-pane"
            >
              <div className="preview-header">
                <h3>Preview ({previewFiles.length})</h3>
                <button onClick={() => setPreviewFiles([])}>×</button>
              </div>
              <div className="preview-content-scroll">
                {previewFiles.map(file => (
                  <div key={file.id} className="preview-card">
                    <div className="preview-card-header">
                      <button 
                        className="action-btn-small open-file-btn"
                        onClick={() => handleShowInFolder(file.path)}
                        title="Show in Explorer"
                      >
                        <FolderOpen size={14} /> Open
                      </button>
                      <button 
                        className="move-bucket-btn"
                        onClick={async () => {
                          await onMove([file.id])
                          // Remove from preview files
                          setPreviewFiles(prev => prev.filter(p => p.id !== file.id))
                          loadDuplicates()
                        }}
                        title="Move file"
                      >
                        <Trash2 size={14} /> Move File
                      </button>
                    </div>
                    <div className="preview-image-container">
                      {(() => {
                        const ext = file.path.split('.').pop()?.toLowerCase()
                        
                        if (loadingPreviews.has(file.path)) {
                          return <div className="no-preview"><p>Loading...</p></div>
                        }

                        const mediaUrl = `media://open?path=${encodeURIComponent(file.path)}`

                        if (['mp3', 'wav', 'ogg'].includes(ext || '')) {
                           return (
                             <audio controls className="preview-media">
                               <source src={mediaUrl} />
                               Your browser does not support the audio element.
                             </audio>
                           )
                        }

                        if (['mp4', 'webm'].includes(ext || '')) {
                            return (
                              <video controls className="preview-media" style={{maxWidth: '100%', maxHeight: '100%'}}>
                                <source src={mediaUrl} />
                                Your browser does not support the video element.
                              </video>
                            )
                        }

                        if (['pdf'].includes(ext || '')) {
                            return (
                                <iframe 
                                    src={mediaUrl} 
                                    className="preview-media"
                                    style={{width: '100%', height: '300px', border: 'none'}}
                                />
                            )
                        }
                        
                        if (previewSrcs.has(file.path)) {
                          return <img src={previewSrcs.get(file.path)} alt="Preview" />
                        }
                        
                        return (
                          <div className="no-preview">
                            {getIcon(file.path)}
                            <p>
                              {previewErrors.has(file.path) ? 'Preview failed' : 
                               ['pptx', 'ppt'].includes(ext || '') ? 'Preview not available for slides' : 'No preview'}
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="file-meta">
                      <p className="file-name" title={file.path.split('\\').pop()}>{file.path.split('\\').pop()}</p>
                      <p><strong>Location:</strong> {file.path}</p>
                      <p><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <p><strong>Created:</strong> {new Date(file.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
