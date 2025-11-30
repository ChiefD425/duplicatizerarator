
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { File, Image, Music, Video, Trash2, Eye, Check, Search, Filter as FilterIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import '../assets/results.css'

interface ResultsProps {
  onMove: (ids: number[]) => void
}

export default function Results({ onMove }: ResultsProps): JSX.Element {
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [previewFile, setPreviewFile] = useState<any | null>(null)
  
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0) // Reset to page 0 on filter change
      loadDuplicates()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, minSize])

  useEffect(() => {
    loadDuplicates()
  }, [page])

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleMove = async () => {
    if (selectedIds.length === 0) return
    await onMove(selectedIds)
    loadDuplicates()
    setSelectedIds([])
  }

  const getIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    if (['jpg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image size={16} />
    if (['mp3', 'wav', 'flac'].includes(ext || '')) return <Music size={16} />
    if (['mp4', 'mkv', 'avi'].includes(ext || '')) return <Video size={16} />
    return <File size={16} />
  }

  const getPreviewSrc = (path: string) => {
    // Use custom protocol for local files
    return `media://${path}`
  }

  return (
    <motion.div 
      className="results-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="results-header">
        <div className="header-top">
          <h2>Duplicates Found</h2>
          <div className="actions">
            <span>{selectedIds.length} selected</span>
            <button 
              className="move-btn"
              disabled={selectedIds.length === 0}
              onClick={handleMove}
            >
              <Trash2 size={16} /> Move
            </button>
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
        </div>
      </div>

      <div className="results-content">
        <div className="list-view">
          {duplicates.map((group, idx) => (
            <div key={idx} className="duplicate-group card glass">
              <div className="group-header">
                <span className="hash-tag">Group #{page * limit + idx + 1}</span>
                <span className="size-tag">{(group[0].size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {group.map((file: any) => (
                <div 
                  key={file.id} 
                  className={`file-row ${selectedIds.includes(file.id) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(file.id)}
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
                      setPreviewFile(file)
                    }}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {duplicates.length === 0 && (
            <div className="empty-state">
              <h3>No duplicates found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {previewFile && (
            <motion.div 
              className="preview-pane glass"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
            >
              <div className="preview-header">
                <h3>Preview</h3>
                <button onClick={() => setPreviewFile(null)}>×</button>
              </div>
              <div className="preview-content">
                {['jpg', 'png', 'gif', 'webp', 'jpeg', 'bmp'].includes(previewFile.path.split('.').pop()?.toLowerCase() || '') ? (
                  <img src={getPreviewSrc(previewFile.path)} alt="Preview" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML += '<p>Preview failed to load</p>'
                  }} />
                ) : (
                  <div className="no-preview">
                    {getIcon(previewFile.path)}
                    <p>No preview available for this file type</p>
                  </div>
                )}
                <div className="file-meta">
                  <p><strong>Path:</strong> {previewFile.path}</p>
                  <p><strong>Size:</strong> {(previewFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p><strong>Created:</strong> {new Date(previewFile.created_at).toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
