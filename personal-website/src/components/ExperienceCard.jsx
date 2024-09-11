import React from "react"
const ExperienceCard = ({ title, company, location, date, bullets }) => {
  return (
    <div className="bg-blue-200 shadow-md rounded-lg p-6 mb-2">
      <div className="flex justify-between items-baseline mb-2">
        <h3 className="text-xl font-bold text-white-800">{title}</h3>
        <p className="text-m text-white-600">{date}</p>
      </div>
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-lg text-white-600">{company}</p>
        <p className="text-m text-white-600">{location}</p>
      </div>
      <ul className="list-none pl-0 space-y-2">
        {bullets.map((bullet, index) => (
          <li key={index} className="text-white-700 flex">
            <span className="mr-2">•</span>
            <span className="flex-1">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
export default ExperienceCard