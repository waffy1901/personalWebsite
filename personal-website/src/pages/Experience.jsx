import React from "react"
import ExperienceCard from "../components/ExperienceCard"

function Experience() {
  const experiences = [
    {
      title: "Frontend Engineer",
      company: "Fintech @ Georgia Tech",
      location: "Atlanta, GA",
      date: "September 2024 - Present",
      bullets: [
        "Reducing page load times by ∼35% via transforming a multi-page credit card website into a React-based single-page application, streamlining card wallet management and adding a card removal feature for authenticated users.",
      ]
    },
    {
      title: "Software Engineer Intern",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "May 2024 - July 2024",
      bullets: [
        "Developed an internal product information page for cashiers, streamlining self-checkout processes and reducing customer wait times for associate intervention by ~25%.",
        "Leveraged Java to obtain germane product data, used React and TypeScript to effectively display product information for all registers at self-checkout, pruning customer theft by ∼$10 million annually."
      ]
    },
    {
      title: "Software Engineer Intern",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "May 2023 - July 2023",
      bullets: [
        "Optimized the efficiency of configuring 40,000+ registers across 2,300 stores by 90%, in collaboration with 2 interns.",
        "Truncated the maximum deployment time of updates to registers from 24+ hours to 30 minutes, leveraging the HttpClient and Flow Java libraries to streamline the retrieval of polymorphic external configurations.",
        "Collaborated with cross-functional teams, including the UI/UX team, to design and construct user interface components for a new configuration process - utilizing React, Next.js, and TypeScript."
      ]
    },
    {
      title: "Undergraduate Teaching Assistant",
      company: "Georgia Tech College of Computing",
      location: "Atlanta, GA",
      date: "January 2023 - May 2023",
      bullets: [
        "Supervised and taught recitations for CS 3001 (Computing & Society) to 20+ students for 4+ hours per week.",
        "Evaluated assignments and exams, grading 20+ students and supplying targeted feedback to enhance performance.",
        "Fostered engagement by answering 105+ questions on Piazza, the student discussion forum."
      ]
    },
    {
      title: "Firmware Engineer Intern",
      company: "Landis+Gyr",
      location: "Alpharetta, GA",
      date: "May 2022 - August 2022",
      bullets: [
        "Accelerated the process of converting DCW (Data Control Words) hexadecimal values to their corresponding ASCII representations by ∼50% through efficient Python practices.",
        "Bolstered data transmission efficiency by ∼25%, collaborating with a software architect to conduct comprehensive testing of collectors and debugging of various Python scripts employing MySQL."
      ]
    },
  ]

  return (
    <div className="bg-blue-300 min-h-screen py-4 font-cambria">
        <div className="max-w-4xl mx-auto px-4 py-4">
            <h2 className="text-3xl text-center font-bold mb-6">Work Experience</h2>
            <div className="space-y-6">
                {experiences.map((exp, index) => (
                <ExperienceCard key={index} {...exp} />
                ))}
            </div>
        </div>
    </div>
  )
}
export default Experience