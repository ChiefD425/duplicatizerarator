
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { File, Image, Music, Video, Trash2, Eye, Check, Search, Filter as FilterIcon, ChevronLeft, ChevronRight, FolderOpen, FileText, Presentation, Folder } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import clsx from 'clsx'
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
  const [stats, setStats] = useState<{ totalFiles: number, originalFiles: number, duplicateFolders: number } | null>(null)
  
  // Filter States
  const [search, setSearch] = useState('')
  const [minSize, setMinSize] = useState(0)
  const [page, setPage] = useState(0)
  const limit = 20

  const [exclusionMenu, setExclusionMenu] = useState<{ x: number, y: number, paths: string[] } | null>(null)

  const handleExclude = async (path: string) => {
    await window.api.addExcludedFolder(path)
    setExclusionMenu(null)
    loadDuplicates()
    loadDuplicateFolders()
    loadStats()
  }

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

  const loadStats = async () => {
    const s = await window.api.getDuplicateStats()
    setStats(s)
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
    loadStats()
  }, [search, minSize, viewMode])

  useEffect(() => {
    loadDuplicates()
  }, [page])

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const newSelection = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      
      // Update preview files based on selection
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
      loadStats()
      setSelectedIds([])
    } else {
      if (selectedFolderPaths.length === 0) return
      
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
        loadStats()
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
      
      if (criteria === 'newest') {
        const sorted = [...group].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        keepId = sorted[0].id
      } else if (criteria === 'oldest') {
        const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        keepId = sorted[0].id
      } else if (criteria === 'shortest') {
        const sorted = [...group].sort((a, b) => a.path.length - b.path.length)
        keepId = sorted[0].id
      }
      
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
             const mediaUrl = `media://open?path=${encodeURIComponent(file.path)}`
             newSrcs.set(file.path, mediaUrl)
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
      className="results-container h-full flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="results-header bg-bg-secondary border-b border-border-color p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gradient">Duplicates Found</h2>
            {stats && (
              <div className="text-sm text-gray-500">
                {stats.originalFiles} originals : {stats.totalFiles} total files | {stats.duplicateFolders} duplicate folders
              </div>
            )}
          </div>
          
          <div className="flex gap-2 bg-bg-tertiary p-1 rounded-lg">
            <Button 
              variant={viewMode === 'files' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('files')}
            >
              Files
            </Button>
            <Button 
              variant={viewMode === 'folders' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('folders')}
            >
              Folders
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {viewMode === 'files' ? selectedIds.length : selectedFolderPaths.length} selected
            </span>
            <Button 
              variant="destructive"
              disabled={selectedIds.length === 0 && selectedFolderPaths.length === 0}
              onClick={handleMove}
              icon={<Trash2 size={16} />}
            >
              Move
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center gap-4">
          <div className="flex gap-2">
             <Button variant="secondary" size="sm" onClick={() => autoSelect('newest')}>Keep Newest</Button>
             <Button variant="secondary" size="sm" onClick={() => autoSelect('oldest')}>Keep Oldest</Button>
             <Button variant="secondary" size="sm" onClick={() => autoSelect('shortest')}>Keep Shortest Name</Button>
          </div>

          <div className="flex gap-4 flex-1 justify-end">
            <div className="relative w-64">
              <Input 
                placeholder="Search files..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search size={16} />}
              />
            </div>
            
            <div className="flex items-center gap-2 bg-bg-tertiary rounded-lg px-3 border border-border-color">
              <FilterIcon size={16} className="text-gray-400" />
              <select 
                value={minSize} 
                onChange={(e) => setMinSize(Number(e.target.value))}
                className="bg-transparent border-none text-sm text-gray-300 focus:outline-none py-2"
              >
                <option value={0}>Any Size</option>
                <option value={500 * 1024}>&gt; 500 KB</option>
                <option value={1024 * 1024}>&gt; 1 MB</option>
                <option value={5 * 1024 * 1024}>&gt; 5 MB</option>
                <option value={100 * 1024 * 1024}>&gt; 100 MB</option>
              </select>
            </div>

            {viewMode === 'files' && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm text-gray-400">Page {page + 1}</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  disabled={duplicates.length < limit}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="results-content flex-1 overflow-hidden flex relative">
        <div className="list-view flex-1 overflow-y-auto p-4 space-y-4">
          {viewMode === 'files' && duplicates.map((group, idx) => (
            <div key={idx} className="duplicate-group card glass p-0 overflow-hidden">
              <div className="group-header bg-bg-tertiary/50 p-3 flex justify-between items-center border-b border-border-color">
                <span 
                  className="text-accent-primary font-medium cursor-pointer hover:underline" 
                  onClick={() => setPreviewFiles(group)}
                  title="Click to preview all files in this group"
                >
                  Group #{page * limit + idx + 1}
                </span>
                <span className="text-xs bg-bg-primary px-2 py-1 rounded text-gray-400">
                  {(group[0].size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              {group.map((file: any) => (
                <div 
                  key={file.id} 
                  className={clsx(
                    "file-row p-3 flex items-center gap-3 border-b border-border-color last:border-0 hover:bg-bg-tertiary/30 transition-colors cursor-pointer",
                    selectedIds.includes(file.id) && "bg-accent-primary/10"
                  )}
                  onClick={() => toggleSelect(file.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleShowInFolder(file.path)
                  }}
                >
                  <div className={clsx(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                    selectedIds.includes(file.id) ? "bg-accent-primary border-accent-primary" : "border-gray-600"
                  )}>
                    {selectedIds.includes(file.id) && <Check size={12} className="text-white" />}
                  </div>
                  <div className="text-gray-400">{getIcon(file.path)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">{file.path.split('\\').pop()}</div>
                    <div className="text-xs text-gray-500 truncate">{file.path}</div>
                  </div>
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewFiles([file])
                    }}
                  >
                    <Eye size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ))}
          
          {viewMode === 'folders' && duplicateFolders.map((group, idx) => (
            <div key={idx} className="duplicate-group card glass p-0 overflow-hidden">
              <div className="group-header bg-bg-tertiary/50 p-3 flex justify-between items-center border-b border-border-color">
                <span className="text-accent-secondary font-medium">Folder Group #{idx + 1}</span>
                <span className="text-xs bg-bg-primary px-2 py-1 rounded text-gray-400">
                  {(group[0].size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              {group.map((folder: any) => (
                <div 
                  key={folder.path} 
                  className={clsx(
                    "file-row p-3 flex items-center gap-3 border-b border-border-color last:border-0 hover:bg-bg-tertiary/30 transition-colors cursor-pointer",
                    selectedFolderPaths.includes(folder.path) && "bg-accent-primary/10"
                  )}
                  onClick={() => toggleFolderSelect(folder.path)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleShowInFolder(folder.path)
                  }}
                >
                  <div className={clsx(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                    selectedFolderPaths.includes(folder.path) ? "bg-accent-primary border-accent-primary" : "border-gray-600"
                  )}>
                    {selectedFolderPaths.includes(folder.path) && <Check size={12} className="text-white" />}
                  </div>
                  <div className="text-accent-secondary"><Folder size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">{folder.path.split(/[/\\]/).pop()}</div>
                    <div className="text-xs text-gray-500 truncate">{folder.path}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {folder.fileCount} files
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={(e) => {
                            e.stopPropagation()
                            const parents: string[] = []
                            let current = folder.path
                            while (current.length > 3) {
                                parents.push(current)
                                const lastSep = Math.max(current.lastIndexOf('/'), current.lastIndexOf('\\'))
                                if (lastSep <= 0) break
                                current = current.substring(0, lastSep)
                            }
                            setExclusionMenu({ x: e.clientX, y: e.clientY, paths: parents })
                        }}
                        title="Exclude folder"
                    >
                        <FilterIcon size={16} />
                    </Button>
                    <Button 
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                        e.stopPropagation()
                        handleShowInFolder(folder.path)
                        }}
                    >
                        <FolderOpen size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          
          {duplicates.length === 0 && viewMode === 'files' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Search size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-medium">No duplicates found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
          {duplicateFolders.length === 0 && viewMode === 'folders' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FolderOpen size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-medium">No duplicate folders found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {previewFiles.length > 0 && (
            <motion.div 
              className="w-[400px] border-l border-border-color bg-bg-secondary/95 backdrop-blur-xl flex flex-col shadow-2xl z-20"
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              key="preview-pane"
            >
              <div className="p-4 border-b border-border-color flex justify-between items-center">
                <h3 className="font-semibold">Preview ({previewFiles.length})</h3>
                <Button variant="ghost" size="sm" onClick={() => setPreviewFiles([])}>×</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {previewFiles.map(file => (
                  <div key={file.id} className="bg-bg-tertiary rounded-lg overflow-hidden border border-border-color">
                    <div className="p-2 bg-black/20 flex justify-end gap-2">
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowInFolder(file.path)}
                        title="Show in Explorer"
                        icon={<FolderOpen size={14} />}
                      >
                        Open
                      </Button>
                      <Button 
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await onMove([file.id])
                          setPreviewFiles(prev => prev.filter(p => p.id !== file.id))
                          loadDuplicates()
                          loadStats()
                        }}
                        title="Move file"
                        icon={<Trash2 size={14} />}
                      >
                        Move
                      </Button>
                    </div>
                    <div className="aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                      {(() => {
                        const ext = file.path.split('.').pop()?.toLowerCase()
                        
                        if (loadingPreviews.has(file.path)) {
                          return <div className="text-gray-500 text-sm">Loading...</div>
                        }

                        const mediaUrl = `media://open?path=${encodeURIComponent(file.path)}`

                        if (['mp3', 'wav', 'ogg'].includes(ext || '')) {
                           return (
                             <audio controls className="w-full">
                               <source src={mediaUrl} />
                             </audio>
                           )
                        }

                        if (['mp4', 'webm'].includes(ext || '')) {
                            return (
                              <video controls className="max-w-full max-h-full">
                                <source src={mediaUrl} />
                              </video>
                            )
                        }

                        if (['pdf'].includes(ext || '')) {
                            return (
                                <iframe 
                                    src={mediaUrl} 
                                    className="w-full h-[200px] border-none"
                                />
                            )
                        }
                        
                        if (previewSrcs.has(file.path)) {
                          return <img src={previewSrcs.get(file.path)} alt="Preview" className="max-w-full max-h-full object-contain" />
                        }
                        
                        return (
                          <div className="flex flex-col items-center text-gray-500 gap-2">
                            {getIcon(file.path)}
                            <p className="text-xs">
                              {previewErrors.has(file.path) ? 'Preview failed' : 
                               ['pptx', 'ppt'].includes(ext || '') ? 'No preview for slides' : 'No preview'}
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="p-3 text-sm space-y-1">
                      <p className="font-medium truncate" title={file.path.split('\\').pop()}>{file.path.split('\\').pop()}</p>
                      <p className="text-gray-500 text-xs truncate" title={file.path}>{file.path}</p>
                      <div className="flex justify-between text-xs text-gray-400 mt-2">
                        <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {exclusionMenu && (
            <div 
                className="fixed bg-bg-secondary border border-border-color rounded-lg shadow-xl z-50 min-w-[200px] overflow-hidden"
                style={{
                    top: exclusionMenu.y,
                    left: exclusionMenu.x > window.innerWidth / 2 ? 'auto' : exclusionMenu.x,
                    right: exclusionMenu.x > window.innerWidth / 2 ? window.innerWidth - exclusionMenu.x : 'auto',
                }}
            >
                <div className="px-3 py-2 text-xs text-gray-500 border-b border-border-color bg-bg-tertiary/50">
                    Exclude Folder
                </div>
                <div className="p-1">
                  {exclusionMenu.paths.map(path => (
                      <button
                          key={path}
                          onClick={() => handleExclude(path)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-accent-primary/10 hover:text-white rounded transition-colors truncate"
                          title={path}
                      >
                          {path}
                      </button>
                  ))}
                </div>
                <div className="p-1 border-t border-border-color">
                  <button
                      onClick={() => setExclusionMenu(null)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-bg-tertiary rounded transition-colors"
                  >
                      Cancel
                  </button>
                </div>
            </div>
        )}
      </AnimatePresence>
      {/* Click outside to close menu */}
      {exclusionMenu && (
        <div 
            className="fixed inset-0 z-40"
            onClick={() => setExclusionMenu(null)}
        />
      )}
    </motion.div>
  )
}
