import React from 'react'
import { FaLinkedin, FaGithub, FaEnvelope } from 'react-icons/fa'
import ContactForm from '../components/ContactForm'

function Contact() {
    return (
        <div className="bg-[#02A8DA] bg-opacity-40 min-h-screen">
          <div className='flex flex-col items-center p-4 font-cambria'>
              <p className="text-lg text-gray-800 mb-4 max-w-2xl text-center">
                  I'm always excited to connect with new people! Whether you have a potential opportunity to discuss, want to expand your professional network, have feedback to share, or merely want to chat, please don't hesitate to reach out!
              </p>
              <div className="w-full flex justify-center">
                  <ContactForm />
              </div>
              <p className='text-lg font-bold leading-relaxed text-gray-700 mb-4 -mt-4'>Alternatively, connect with me here</p>
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
                    <FaEnvelope className="mr-2" />
                    Email
                  </a>
              </div>
          </div>
        </div>
    )
}
export default Contact