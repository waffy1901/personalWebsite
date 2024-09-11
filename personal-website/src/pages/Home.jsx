import React from 'react'
import profilePicture from '../images/profilePic.jpg'
import { FaLinkedin, FaGithub, FaEnvelope } from 'react-icons/fa'

function Home() {
  return (
    <div className='min-h-screen flex flex-col font-["Cambria",_serif]'>
      <nav className='bg-blue-100 p-4 relative'>
        <div className='text-center'>
          <h1 className='text-3xl font-bold text-gray-700'>Waffy Ahmed</h1>
          <p className='text-xl text-gray-700'>Software Engineer | Georgia Tech</p>
        </div>
        <div className='absolute top-6 right-6'>
          <a
            href="/waffyAhmedResume.pdf"
            download
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
          >
            Download Resume
          </a>
        </div>
      </nav>

      <main className='flex-grow bg-blue-100'>
        <div className='container mx-auto px-4'>
          <section className='py-12'>
            <div className='flex flex-col md:flex-row justify-center items-start gap-8 max-w-4xl mx-auto'>
              <div className='w-full md:w-1/2 flex-grow'>
                <p className='text-lg leading-relaxed text-gray-700'>
                  I am a senior majoring in Computer Science at Georgia Tech, set to graduate in December 2024 with 
                  my Bachelor's. I am a problem-solver at heart. As such, software engineering is a perfect fit for me. I have plenty of prior 
                  experience. I have completed 3 internships, oversaw a team of 6 to automate a laborious and redundant task for the CDC while also working as a full-stack 
                  software developer, and am currently working as an engineer at Fintech @ Georgia Tech. For a more in-depth overview, check out
                  the distinct sections on the navigation bar.
                </p>
              </div>
              
              <div className='w-full md:w-1/2 flex justify-center items-start'>
                <img 
                  src={profilePicture} 
                  alt="Waffy Ahmed" 
                  className='h-[285px] w-auto object-cover rounded-lg shadow-lg'
                />
              </div>
            </div>

            <div className='flex flex-col items-center mt-4'>
              <p className='text-lg font-bold leading-relaxed text-gray-700 mb-4'>Connect with me</p>
              <div className='flex justify-center space-x-4'>
                <a 
                  href="https://www.linkedin.com/in/wa24/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className='bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center'
                >
                  <FaLinkedin className="mr-2" />
                  LinkedIn
                </a>
                <a 
                  href="https://github.com/waffy1901" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className='bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded inline-flex items-center'
                >
                  <FaGithub className="mr-2" />
                  GitHub
                </a>
                <a 
                  href="mailto:waffyahmed@gmail.com" 
                  className='bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded inline-flex items-center'
                >
                  <FaEnvelope className="mr-2"/>
                  Email
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
export default Home