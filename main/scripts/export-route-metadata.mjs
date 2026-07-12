#!/usr/bin/env node
import {
  routeMetadata,
  siteMetadata,
  toAbsoluteUrl,
} from "../src/data/seo.js"

const routes = routeMetadata.map(({ path, title, description }) => ({
  path,
  title,
  description,
  canonicalUrl: toAbsoluteUrl(path),
}))

process.stdout.write(
  JSON.stringify({
    imageUrl: toAbsoluteUrl(siteMetadata.imagePath),
    routes,
  })
)
