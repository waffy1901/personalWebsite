import React, { useState } from "react"
import { FaGithub } from "react-icons/fa"

function ProjectCard({ title, techStack, bullets, github, logo }) {
  const [expanded, setExpanded] = useState(false)
  const maxVisibleBullets = 2

  return (
    <div className="bg-blue-100 rounded-lg shadow-md p-6 w-full relative flex flex-col h-full">
      <a href={github} target="_blank" rel="noopener noreferrer" className="absolute top-4 right-4 flex items-center text-gray-600 hover:text-gray-800">
        <FaGithub className="mr-1" />
        <span>Source Code</span>
      </a>
      <div className="flex items-center mb-4">
        <h2 className="text-2xl font-bold mr-2">{title}</h2>
        {logo && (
              <img 
                src={logo} 
                alt={`${title} logo`} 
                className="h-8 w-8 object-contain"
              />
            )}
      </div>
      <p className="text-gray-600 mb-4">{techStack}</p>
      <div className={`overflow-hidden ${expanded ? 'h-auto' : 'h-40'}`}>
        <ul className="list-disc list-inside">
          {bullets.map((bullet, index) => (
            <li key={index} className="text-gray-700 flex mb-2">
              <span className="mr-2">•</span>
              <span className="flex-1">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      {bullets.length > maxVisibleBullets && (
        <button
          className="mt-4 text-blue-500 hover:text-blue-700"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  )
}
export default ProjectCard