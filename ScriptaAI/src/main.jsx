import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import LandingPage from './Landing.jsx'
import Storyboard from './pages/Storyboard.jsx'
import VideoPreview from './pages/VideoPreview.jsx'
import Editor from './pages/Editor.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/storyboard" element={<Storyboard />} />
        <Route path="/preview" element={<VideoPreview />} />
        <Route path="/editor" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
