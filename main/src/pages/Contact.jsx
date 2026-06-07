import React from 'react'
import ContactForm from '../components/ContactForm'
import SocialLinks from '../components/SocialLinks'
import { contact } from '../data/profile'

function Contact() {
    return (
        <div className="bg-[#02A8DA] bg-opacity-40 min-h-screen">
          <div className='flex flex-col items-center p-4 font-cambria'>
              <h1 className="mb-4 text-center text-3xl font-bold text-gray-800">
                  {contact.heading}
              </h1>
              <p className="text-lg text-gray-800 mb-4 max-w-2xl text-center">
                  {contact.intro}
              </p>
              <div className="w-full flex justify-center">
                  <ContactForm />
              </div>
              <p className='text-lg font-bold leading-relaxed text-gray-700 mb-4 -mt-4'>Alternatively, connect with me here</p>
              <SocialLinks placement="contact" />
          </div>
        </div>
    )
}
export default Contact
