#!/usr/bin/env node
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const checkerPath = join(dirname(fileURLToPath(import.meta.url)), "check_frontend_performance.mjs")

function writeFixture(root, relativePath, contents) {
  const filePath = join(root, relativePath)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, contents)
}

function replaceFixture(root, relativePath, replacements) {
  const filePath = join(root, relativePath)
  let contents = readFileSync(filePath, "utf8")

  for (const [from, to] of replacements) {
    assert.ok(contents.includes(from), `Fixture is missing expected text: ${from}`)
    contents = contents.replace(from, to)
  }

  writeFileSync(filePath, contents)
}

function runChecker(fixtureRoot) {
  return spawnSync(process.execPath, [checkerPath, fixtureRoot], { encoding: "utf8" })
}

function createFixture(decoding) {
  const root = mkdtempSync(join(tmpdir(), "portfolio-performance-"))

  writeFixture(
    root,
    "main/src/App.jsx",
    [
      'import { lazy, Suspense } from "react"',
      'import { Route, Routes } from "react-router-dom"',
      'import Home from "./pages/Home.jsx"',
      "",
      'const Resume = lazy(() => import("./pages/Resume.jsx"))',
      'const Contact = lazy(() => import("./pages/Contact.jsx"))',
      'const CaseStudies = lazy(() => import("./pages/CaseStudies.jsx"))',
      'const CaseStudy = lazy(() => import("./pages/CaseStudy.jsx"))',
      'const Experience = lazy(() => import("./pages/Experience.jsx"))',
      'const Projects = lazy(() => import("./pages/Projects.jsx"))',
      'const NotFound = lazy(() => import("./pages/NotFound.jsx"))',
      "",
      "function RouteLoadingFallback() {",
      '  return <div role="status" aria-live="polite">Loading</div>',
      "}",
      "",
      "export default function App() {",
      "  return (",
      "    <Suspense fallback={<RouteLoadingFallback />}>",
      "      <Routes>",
      '        <Route path="/" element={<Home />} />',
      '        <Route path="/resume" element={<Resume />} />',
      '        <Route path="/contact" element={<Contact />} />',
      '        <Route path="/case-studies" element={<CaseStudies />} />',
      '        <Route path="/case-studies/:slug" element={<CaseStudy />} />',
      '        <Route path="/experience" element={<Experience />} />',
      '        <Route path="/projects" element={<Projects />} />',
      '        <Route path="*" element={<NotFound />} />',
      "      </Routes>",
      "    </Suspense>",
      "  )",
      "}",
      "",
    ].join("\n"),
  )
  writeFixture(
    root,
    "main/src/pages/Home.jsx",
    [
      "export default function Home({ profile }) {",
      '  return <img src={profile.profilePicture} loading="eager" fetchPriority="high" decoding="async" alt="Profile" />',
      "}",
      "",
    ].join("\n"),
  )
  writeFixture(
    root,
    "main/src/pages/Resume.jsx",
    [
      "export default function Resume() {",
      '  return <img src="/resume-preview.png" loading="eager" fetchPriority="high" decoding="async" alt="Resume preview" />',
      "}",
      "",
    ].join("\n"),
  )
  writeFixture(
    root,
    "main/src/components/ProjectCard.jsx",
    [
      "export default function ProjectCard() {",
      '  return <img src="/project.png" loading="lazy" decoding="' + decoding + '" alt="Project" />',
      "}",
      "",
    ].join("\n"),
  )

  return root
}

test("accepts a valid route and image fixture", () => {
  const fixtureRoot = createFixture("async")

  try {
    const result = runChecker(fixtureRoot)

    assert.equal(result.status, 0)
    assert.match(result.stdout, /policy check passed/)
    assert.equal(result.stderr, "")
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test('rejects image decoding values other than "async"', () => {
  const fixtureRoot = createFixture("sync")

  try {
    const result = runChecker(fixtureRoot)

    assert.equal(result.status, 1)
    assert.match(result.stderr, /ProjectCard\.jsx has an <img> without decoding="async"/)
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test("rejects data attributes that resemble image policy attributes", () => {
  const fixtureRoot = createFixture("async")

  try {
    replaceFixture(fixtureRoot, "main/src/components/ProjectCard.jsx", [
      ['loading="lazy"', 'data-loading="lazy"'],
      ['decoding="async"', 'data-decoding="async"'],
    ])
    const result = runChecker(fixtureRoot)

    assert.equal(result.status, 1)
    assert.match(result.stderr, /without decoding="async"/)
    assert.match(result.stderr, /without loading="lazy"/)
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test("rejects lazy pages that are not used by their routes", () => {
  const fixtureRoot = createFixture("async")

  try {
    replaceFixture(fixtureRoot, "main/src/App.jsx", [
      ['path="/resume" element={<Resume />}', 'path="/resume" element={<Home />}'],
    ])
    const result = runChecker(fixtureRoot)

    assert.equal(result.status, 1)
    assert.match(result.stderr, /should render Resume for route \/resume/)
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test("rejects an unrelated Suspense boundary outside the route tree", () => {
  const fixtureRoot = createFixture("async")

  try {
    replaceFixture(fixtureRoot, "main/src/App.jsx", [
      [
        "    <Suspense fallback={<RouteLoadingFallback />}>",
        "    <>\n      <Suspense fallback={null}><Home /></Suspense>",
      ],
      ["    </Suspense>", "    </>"],
    ])
    const result = runChecker(fixtureRoot)

    assert.equal(result.status, 1)
    assert.match(result.stderr, /should wrap lazy routes in Suspense/)
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})

test("rejects sibling Suspense boundaries around an unwrapped route tree", () => {
  const fixtureRoot = createFixture("async")

  try {
    replaceFixture(fixtureRoot, "main/src/App.jsx", [
      [
        "    <Suspense fallback={<RouteLoadingFallback />}>",
        "    <>\n      <Suspense fallback={null}><Home /></Suspense>",
      ],
      [
        "    </Suspense>",
        "      <Suspense fallback={null}><Home /></Suspense>\n    </>",
      ],
    ])
    const result = runChecker(fixtureRoot)

    assert.equal(result.status, 1)
    assert.match(result.stderr, /should wrap lazy routes in Suspense/)
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
})
