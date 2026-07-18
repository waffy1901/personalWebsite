import React, { useEffect, useRef } from 'react'
import { useForm, ValidationError } from '@formspree/react'
import { socialLinks } from '../data/profile'
import { trackEvent, trackLinkClick } from '../utils/analytics'

const fieldLimits = {
  name: 60,
  email: 254,
  messageMin: 10,
  messageMax: 1500,
}

function ContactForm() {
  const formKey = import.meta.env.VITE_FORMSPREE_KEY
  const emailLink = socialLinks.find((link) => link.id === "email")

  if (!formKey) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-center text-white">
        <h2 className="mb-4 text-2xl font-black text-white">Contact Form</h2>
        <p className="text-slate-300">
          The contact form is unavailable right now.{" "}
          {emailLink ? (
            <a
              className="font-black text-[#FFB077] underline"
              href={emailLink.href}
              onClick={() =>
                trackLinkClick("contact_email_click", {
                  href: emailLink.href,
                  label: emailLink.label,
                  placement: "contact_form_fallback",
                })
              }
            >
              Open an email draft
            </a>
          ) : (
            "Please use one of the alternate contact links"
          )}
          .
        </p>
      </div>
    )
  }

  return <ContactFormFields formKey={formKey} />
}

function ContactFormFields({ formKey }) {
  const [state, handleSubmit] = useForm(formKey)
  const successRef = useRef(null)
  const errorRef = useRef(null)
  const handleTrackedSubmit = (event) => {
    if (state.submitting) {
      event.preventDefault()
      return undefined
    }

    const formData = new FormData(event.currentTarget)
    if (formData.get("_gotcha")) {
      event.preventDefault()
      return undefined
    }

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
      successRef.current?.focus()
    }
  }, [state.succeeded])

  useEffect(() => {
    if (state.errors) {
      errorRef.current?.focus()
    }
  }, [state.errors])

  if (state.succeeded) {
    return (
      <div
        ref={successRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        tabIndex="-1"
        className="rounded-2xl border border-white/10 bg-white/[0.08] p-6 text-center focus:outline-hidden focus:ring-2 focus:ring-[#20A875] focus:ring-offset-2 focus:ring-offset-[#0B1220]"
      >
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
        {state.errors ? (
          <div
            ref={errorRef}
            role="alert"
            tabIndex="-1"
            className="mb-4 rounded-lg border border-[#FFB077]/40 bg-[#F96302]/15 p-4 text-sm text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#FFB077] focus:ring-offset-2 focus:ring-offset-[#0B1220]"
          >
            <p className="font-black text-white">The message could not be sent.</p>
            <p className="mt-1 leading-relaxed text-slate-200">
              Please check the highlighted fields and try again.
            </p>
          </div>
        ) : null}
        <div className="absolute left-[-9999px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="company">Company</label>
          <input
            type="text"
            name="_gotcha"
            id="company"
            tabIndex="-1"
            autoComplete="off"
          />
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-2 block font-black text-slate-200">First Name</label>
            <input
              type="text"
              name="firstName"
              id="firstName"
              placeholder="Enter first name"
              className="mc-field"
              maxLength={fieldLimits.name}
              autoComplete="given-name"
              title="First name can be up to 60 characters."
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
              maxLength={fieldLimits.name}
              autoComplete="family-name"
              title="Last name can be up to 60 characters."
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
            maxLength={fieldLimits.email}
            autoComplete="email"
            title="Use a valid email address so I can reply."
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
            placeholder="Share a few details"
            className="mc-field min-h-36"
            rows="4"
            minLength={fieldLimits.messageMin}
            maxLength={fieldLimits.messageMax}
            title="Message must be 10 to 1500 characters."
            required
          />
          <p className="mt-2 text-xs font-bold text-slate-400">
            {fieldLimits.messageMin}-{fieldLimits.messageMax} characters helps keep the signal clear.
          </p>
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
