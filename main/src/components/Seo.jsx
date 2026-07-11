import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import {
  getRouteMetadata,
  siteMetadata,
  toAbsoluteUrl,
} from "../data/seo"

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement("meta")
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value)
  })
}

const upsertLink = (selector, attributes) => {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement("link")
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value)
  })
}

function Seo() {
  const location = useLocation()

  useEffect(() => {
    const metadata = getRouteMetadata(location.pathname)
    const canonicalUrl = toAbsoluteUrl(
      metadata.canonicalPath ?? metadata.path ?? location.pathname
    )
    const imageUrl = toAbsoluteUrl(siteMetadata.imagePath)
    const robots = metadata.robots ?? "index, follow"

    document.title = metadata.title

    upsertLink('link[rel="canonical"]', {
      rel: "canonical",
      href: canonicalUrl,
    })

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: metadata.description,
    })
    upsertMeta('meta[name="author"]', {
      name: "author",
      content: siteMetadata.author,
    })
    upsertMeta('meta[name="keywords"]', {
      name: "keywords",
      content: siteMetadata.keywords.join(", "),
    })
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: robots,
    })
    upsertMeta('meta[property="og:url"]', {
      property: "og:url",
      content: canonicalUrl,
    })
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: metadata.title,
    })
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: metadata.description,
    })
    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: imageUrl,
    })
    upsertMeta('meta[property="og:image:secure_url"]', {
      property: "og:image:secure_url",
      content: imageUrl,
    })
    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: metadata.title,
    })
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: metadata.description,
    })
    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: imageUrl,
    })
  }, [location.pathname])

  return null
}

export default Seo
