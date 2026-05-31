import React from "react"
import { Link } from "react-router-dom"

function NotFound() {
  return (
    <main className="min-h-screen bg-blue-100 px-4 py-16 font-cambria">
      <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-700">
          404
        </p>
        <h1 className="mb-4 text-4xl font-bold text-gray-800">
          Page not found
        </h1>
        <p className="mb-6 text-lg leading-relaxed text-gray-700">
          That page does not exist, but the portfolio is still right here.
        </p>
        <Link
          to="/"
          className="rounded bg-blue-600 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          Go home
        </Link>
      </section>
    </main>
  )
}

export default NotFound
