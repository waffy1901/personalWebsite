import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home.jsx"
import Resume from "./pages/Resume.jsx"
import Navbar from "./components/Navbar.jsx"
import React, { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    document.title = "Waffy's Website"
  }, [])

  return (
    <div className='flex flex-col w-screen h-screen'>
      <Navbar />
      <div className='flex-1 overflow-auto bg-slate-100'>
		<Routes>
          <Route path='/' element={<Home />} />
          <Route path='/Resume' element={<Resume />} />
        </Routes>
      </div>
    </div>
  )
}