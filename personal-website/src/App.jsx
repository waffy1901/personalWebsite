import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home.jsx"
import Resume from "./pages/Resume.jsx"
import Contact from "./pages/Contact.jsx"
import Experience from "./pages/Experience.jsx"
import Projects from "./pages/Projects.jsx"
import Navbar from "./components/Navbar.jsx"
import React from "react"

export default function App() {
  return (
    <div className='flex flex-col w-screen h-screen'>
      <Navbar />
      <div className='flex-1 overflow-auto bg-slate-100'>
		    <Routes>
          <Route path='/' element={<Home/>}/>
          <Route path='/Resume' element={<Resume/>}/>
          <Route path='/Contact' element={<Contact/>}/>
          <Route path='/Experience' element={<Experience/>}/>
          <Route path='/Projects' element={<Projects/>}/>
        </Routes>
      </div>
    </div>
  )
}