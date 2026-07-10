#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

const repoRoot = process.argv[2] || process.cwd()
const srcRoot = join(repoRoot, "main", "src")
const errors = []
const warnings = []
const lcpImagePolicies = [
  {
    file: join(srcRoot, "pages", "Home.jsx"),
    label: "Home profile image",
    pattern: /src=\{profile\.profilePicture\}/,
  },
  {
    file: join(srcRoot, "pages", "Resume.jsx"),
    label: "Resume preview image",
    pattern: /resume-preview\.png|resumePreview|src=\{resume\.preview\}/,
  },
]

function readText(filePath) {
  try {
    return readFileSync(filePath, "utf8")
  } catch (error) {
    errors.push(`Unable to read ${relative(repoRoot, filePath)}: ${error.message}`)
    return ""
  }
}

function walkJsxFiles(dir) {
  if (!existsSync(dir)) {
    errors.push(`Missing source directory: ${relative(repoRoot, dir)}`)
    return []
  }

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      return walkJsxFiles(fullPath)
    }

    return entry.isFile() && fullPath.endsWith(".jsx") ? [fullPath] : []
  })
}

function stripJsxComments(source) {
  return source.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
}

function imgTags(source) {
  return [...stripJsxComments(source).matchAll(/<img\b[\s\S]*?(?:\/>|>)/g)].map(
    (match) => match[0],
  )
}

function attrValue(tag, attrName) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`, "i").exec(tag)
  return match ? match[1] ?? match[2] ?? match[3] ?? "" : null
}

function normalizedAttrValue(value) {
  return value?.replace(/["'{}]/g, "").trim().toLowerCase() ?? null
}

function shortTag(tag) {
  return tag.replace(/\s+/g, " ").slice(0, 140)
}

function jsxTagEnd(source, tagStart) {
  let braceDepth = 0
  let quote = null

  for (let index = tagStart; index < source.length; index += 1) {
    const character = source[index]

    if (quote) {
      if (character === quote && source[index - 1] !== "\\") {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
    } else if (character === "{") {
      braceDepth += 1
    } else if (character === "}") {
      braceDepth = Math.max(0, braceDepth - 1)
    } else if (character === ">" && braceDepth === 0) {
      return index
    }
  }

  return -1
}

function hasSuspenseWrappedRoutes(source) {
  const sourceWithoutComments = stripJsxComments(source)
  const routesStart = sourceWithoutComments.search(/<Routes\b/)
  const routesEnd = sourceWithoutComments.indexOf("</Routes>", routesStart)

  if (routesStart === -1 || routesEnd === -1) {
    return false
  }

  const openBoundaries = []
  const pairedBoundaries = []

  for (const match of sourceWithoutComments.matchAll(/<(\/)?(?:React\.)?Suspense\b/g)) {
    if (match[1]) {
      const start = openBoundaries.pop()
      if (start !== undefined) {
        pairedBoundaries.push({ start, end: match.index })
      }
      continue
    }

    const tagEnd = jsxTagEnd(sourceWithoutComments, match.index)
    const openingTag = sourceWithoutComments.slice(match.index, tagEnd + 1)
    if (tagEnd !== -1 && !/\/\s*>$/.test(openingTag)) {
      openBoundaries.push(match.index)
    }
  }

  return pairedBoundaries.some(
    ({ start, end }) => start < routesStart && end > routesEnd,
  )
}

function checkAppLazyLoading() {
  const appPath = join(srcRoot, "App.jsx")
  const appSource = readText(appPath)
  const eagerHomePattern = /import\s+Home\s+from\s+["']\.\/pages\/Home\.jsx["']/
  const lazyRoutePolicies = [
    { page: "Resume", path: "/resume" },
    { page: "Contact", path: "/contact" },
    { page: "CaseStudies", path: "/case-studies" },
    { page: "CaseStudy", path: "/case-studies/:slug" },
    { page: "Experience", path: "/experience" },
    { page: "Projects", path: "/projects" },
    { page: "NotFound", path: "*" },
  ]

  if (!eagerHomePattern.test(appSource)) {
    errors.push("main/src/App.jsx should import Home eagerly for the default route.")
  }

  if (/\bconst\s+Home\s*=\s*lazy\s*\(/.test(appSource)) {
    errors.push("main/src/App.jsx should not lazy-load Home because it delays homepage LCP discovery.")
  }

  for (const { page, path } of lazyRoutePolicies) {
    const escapedPage = page.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const lazyImportPattern = new RegExp(
      `\\bconst\\s+${escapedPage}\\s*=\\s*lazy\\s*\\(\\s*\\(\\)\\s*=>\\s*import\\(\\s*["']\\.\\/pages\\/${escapedPage}\\.jsx["']\\s*\\)\\s*\\)`,
    )
    const routePattern = new RegExp(
      `<Route\\b(?:(?!<Route\\b)[\\s\\S])*?\\bpath\\s*=\\s*["']${escapedPath}["'](?:(?!<Route\\b)[\\s\\S])*?\\belement\\s*=\\s*\\{\\s*<${escapedPage}\\s*\\/>\\s*\\}`,
    )

    if (!lazyImportPattern.test(appSource)) {
      errors.push(`main/src/App.jsx should lazy-load ${page} from ./pages/${page}.jsx.`)
    }

    if (!routePattern.test(appSource)) {
      errors.push(`main/src/App.jsx should render ${page} for route ${path}.`)
    }
  }

  if (!hasSuspenseWrappedRoutes(appSource)) {
    errors.push("main/src/App.jsx should wrap lazy routes in Suspense.")
  }

  if (!/RouteLoadingFallback/.test(appSource)) {
    warnings.push("main/src/App.jsx does not define RouteLoadingFallback; confirm the Suspense fallback is accessible.")
  }

  if (!/role=\"status\"/.test(appSource) || !/aria-live=\"polite\"/.test(appSource)) {
    warnings.push("Route loading fallback should expose role=\"status\" and aria-live=\"polite\".")
  }
}

function checkImageTags() {
  for (const filePath of walkJsxFiles(srcRoot)) {
    const relativePath = relative(repoRoot, filePath)
    const source = readText(filePath)

    for (const tag of imgTags(source)) {
      const loading = attrValue(tag, "loading")
      const decoding = attrValue(tag, "decoding")
      const fetchPriority = attrValue(tag, "fetchPriority") ?? attrValue(tag, "fetchpriority")
      const isLcpImage = lcpImagePolicies.some(
        (image) => image.file === filePath && image.pattern.test(tag),
      )

      if (normalizedAttrValue(decoding) !== "async") {
        errors.push(`${relativePath} has an <img> without decoding="async": ${shortTag(tag)}`)
      }

      if (!isLcpImage && loading !== "lazy") {
        errors.push(`${relativePath} has a non-LCP <img> without loading=\"lazy\": ${shortTag(tag)}`)
      }

      if (!isLcpImage && normalizedAttrValue(fetchPriority) === "high") {
        errors.push(`${relativePath} has fetchPriority=\"high\" on a non-LCP <img>: ${shortTag(tag)}`)
      }

      if (/\{\s*\.\.\./.test(tag)) {
        warnings.push(`${relativePath} uses spread props on an <img>; inspect image policy manually: ${shortTag(tag)}`)
      }
    }
  }
}

function checkHeroImagePolicy() {
  for (const image of lcpImagePolicies) {
    const source = readText(image.file)
    const tags = imgTags(source)
    const tag = tags.find((candidate) => image.pattern.test(candidate))
    const relativePath = relative(repoRoot, image.file)

    if (!tag) {
      warnings.push(`${image.label} was not found in ${relativePath}; confirm LCP image policy manually.`)
      continue
    }

    if (attrValue(tag, "loading") !== "eager") {
      errors.push(`${image.label} should use loading=\"eager\" in ${relativePath}.`)
    }

    const fetchPriority = attrValue(tag, "fetchPriority") ?? attrValue(tag, "fetchpriority")
    if (fetchPriority !== "high") {
      errors.push(`${image.label} should use fetchPriority=\"high\" in ${relativePath}.`)
    }

    if (normalizedAttrValue(attrValue(tag, "decoding")) !== "async") {
      errors.push(`${image.label} should use decoding=\"async\" in ${relativePath}.`)
    }
  }
}

checkAppLazyLoading()
checkImageTags()
checkHeroImagePolicy()

for (const warning of warnings) {
  console.warn(`[warn] ${warning}`)
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[error] ${error}`)
  }
  process.exit(1)
}

console.log("Frontend performance policy check passed.")
