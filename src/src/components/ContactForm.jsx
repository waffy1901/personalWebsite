import React from 'react'
import { useForm, ValidationError } from '@formspree/react'

function ContactForm() {
  const [state, handleSubmit] = useForm("mrbzvggz")
  if (state.succeeded) {
    return <p className="text-xl text-green-600 font-bold text-center mb-4">Thank you for your message! I will reach out as soon as possible!</p>
  }
  return (
    <div className="w-1/2 border border-gray-300 rounded-lg p-6 mb-8 shadow-lg bg-blue-100">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">Contact Form</h2>
      <form onSubmit={handleSubmit}>
        <div className="flex mb-4 space-x-4">
          <div className="w-1/2">
            <label htmlFor="firstName" className="block text-gray-700 font-bold mb-2">First Name</label>
            <input
              type="text"
              name="firstName"
              id="firstName"
              placeholder="Enter first name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            />
          </div>
          <div className="w-1/2">
            <label htmlFor="lastName" className="block text-gray-700 font-bold mb-2">Last Name</label>
            <input
              type="text"
              name="lastName"
              id="lastName"
              placeholder="Enter last name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            />
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 font-bold mb-2">Email</label>
          <input
            type="email"
            name="email"
            id="email"
            placeholder="Enter email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            required
          />
          <ValidationError prefix="Email" field="email" errors={state.errors} />
        </div>
        <div className="mb-4">
          <label htmlFor="message" className="block text-gray-700 font-bold mb-2">Message</label>
          <textarea
            id="message"
            name="message"
            placeholder="Enter message"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            rows="4"
            required
          >
          </textarea>
          <ValidationError prefix="Message" field="message" errors={state.errors} />
        </div>
        <div className="flex justify-center">
          <button type="submit" disabled={state.submitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Send Message
          </button>
        </div>
      </form>
    </div>
  )
}
export default ContactForm