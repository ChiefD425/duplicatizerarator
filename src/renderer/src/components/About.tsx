import { motion } from 'framer-motion'
import { Github, Mail, X } from 'lucide-react'
import packageJson from '../../../../package.json'
import '../assets/about.css'

interface AboutProps {
  onClose: () => void
}

export default function About({ onClose }: AboutProps): JSX.Element {
  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="modal-content glass"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close-btn" onClick={onClose}>
          <X size={24} />
        </button>
        
        <div className="about-header">
          <img src="../../resources/icon.png" alt="Logo" className="about-logo" />
          <h2>Duplicatizerarator</h2>
          <span className="version">v{packageJson.version}</span>
        </div>

        <div className="about-body">
          <p>
            A modern, high-performance duplicate file finder designed to help you reclaim your storage space with style.
          </p>
          
          <h3>License</h3>
          <p>Released under the <strong>GPL v3 License</strong>. Free and Open Source.</p>

          <h3>Credits</h3>
          <div className="credits">
            <p>Created by <strong>Fred Deichler</strong></p>
            <div className="social-links">
              <a href="https://github.com/ChiefD425/duplicatizerarator" target="_blank" rel="noreferrer" title="GitHub">
                <Github size={20} />
              </a>
              <a href="mailto:fred.deichler@gmail.com" title="Contact">
                <Mail size={20} />
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
