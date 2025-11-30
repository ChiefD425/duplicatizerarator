import { useState } from 'react'
import { motion } from 'framer-motion'

function App(): JSX.Element {
  const [count, setCount] = useState(0)

  return (
    <div className="container">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Duplicatizerarator
      </motion.h1>
      <p className="subtitle">Modern Duplicate File Finder</p>
      
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
