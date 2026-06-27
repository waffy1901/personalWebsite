import React, { useEffect } from 'react'
import { useForm, ValidationError } from '@formspree/react'
import { trackEvent, trackLinkClick } from '../utils/analytics'

function ContactForm() {
  const formKey = import.meta.env.VITE_FORMSPREE_KEY

  if (!formKey) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-center text-white">
        <h2 className="mb-4 text-2xl font-black text-white">Contact Form</h2>
        <p className="text-slate-300">
          The contact form is unavailable right now. Please email me at{" "}
          <a
            className="font-black text-[#FFB077] underline"
            href="mailto:waffyahmed@gmail.com"
            onClick={() =>
              trackLinkClick("contact_email_click", {
                href: "mailto:waffyahmed@gmail.com",
                label: "waffyahmed@gmail.com",
                placement: "contact_form_fallback",
              })
            }
          >
            waffyahmed@gmail.com
          </a>.
        </p>
      </div>
    )
  }

  return <ContactFormFields formKey={formKey} />
}

function ContactFormFields({ formKey }) {
  const [state, handleSubmit] = useForm(formKey)
  const handleTrackedSubmit = (event) => {
    trackEvent("contact_form_submit", {
      placement: "contact_form",
    })
    return handleSubmit(event)
  }

  useEffect(() => {
    if (state.succeeded) {
      trackEvent("contact_form_success", {
        placement: "contact_form",
      })
    }
  }, [state.succeeded])

  if (state.succeeded) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-center">
        <p className="text-xl font-black text-emerald-300">
          Thank you for your message! I will reach out as soon as possible!
        </p>
      </div>
    )
  }
  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <h2 className="mb-5 text-center text-2xl font-black text-white">Contact Form</h2>
      <form onSubmit={handleTrackedSubmit}>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-2 block font-black text-slate-200">First Name</label>
            <input
              type="text"
              name="firstName"
              id="firstName"
              placeholder="Enter first name"
              className="mc-field"
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="mb-2 block font-black text-slate-200">Last Name</label>
            <input
              type="text"
              name="lastName"
              id="lastName"
              placeholder="Enter last name"
              className="mc-field"
              required
            />
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block font-black text-slate-200">Email</label>
          <input
            type="email"
            name="email"
            id="email"
            placeholder="Enter email"
            className="mc-field"
            required
          />
          <ValidationError
            prefix="Email"
            field="email"
            errors={state.errors}
            className="mt-2 text-sm font-bold text-[#FFB077]"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="message" className="mb-2 block font-black text-slate-200">Message</label>
          <textarea
            id="message"
            name="message"
            placeholder="Enter message"
            className="mc-field min-h-36"
            rows="4"
            required
          />
          <ValidationError
            prefix="Message"
            field="message"
            errors={state.errors}
            className="mt-2 text-sm font-bold text-[#FFB077]"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={state.submitting}
            className="mc-button-primary px-5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send Message
          </button>
        </div>
      </form>
    </div>
  )
}

export default ContactForm
