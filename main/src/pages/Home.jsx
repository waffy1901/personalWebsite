import React from 'react'
import profilePicture from '../images/profilePic.jpg'
import { FaLinkedin, FaGithub, FaEnvelope, FaDownload } from 'react-icons/fa'
import gtLogo from '../images/gtLogo.png'

function Home() {
  return (
    <div className='min-h-screen flex flex-col font-cambria'>
      <nav className='bg-blue-100 p-4'>
        <div className='flex flex-col sm:flex-row justify-between items-center'>
          <div className='flex items-center mb-4 sm:mb-0'>
            <img 
              src={gtLogo} 
              alt="Georgia Tech Logo" 
              className='h-16 w-auto'
            />
          </div>
          <div className='flex-grow text-center mb-4 sm:mb-0'>
            <h1 className='text-3xl font-bold text-gray-700'>Waffy Ahmed</h1>
            <p className='text-xl text-gray-700'>Software Engineer | Georgia Tech</p>
          </div>
          <div className='mb-4 sm:mb-0'>
            <a
              href="/waffyAhmedResume.pdf"
              download
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors inline-flex items-center"
            >
              <FaDownload className="mr-2" />
              Download Resume
            </a>
          </div>
        </div>
      </nav>

      <main className='flex-grow bg-blue-100'>
        <div className='container mx-auto px-4'>
          <section className='py-12'>
            <div className='flex flex-col md:flex-row justify-center items-start gap-8 max-w-4xl mx-auto'>
              <div className='w-full md:w-1/2 flex-grow'>
                <p className='text-lg leading-relaxed text-gray-700'>
                 I am a Software Engineer at The Home Depot and a graduate of the Georgia Institute of Technology with a Bachelor’s 
                 in Computer Science. I have completed three internships, led a team of six to automate redundant processes for the CDC 
                 while also serving as a full-stack developer, and contributed as a frontend engineer at Fintech @ Georgia Tech. 
                 Explore the sections above for a deeper look at my experience and projects.
                </p>
              </div>
              
              <div className='w-full md:w-1/2 flex justify-center items-start -mt-5'>
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