import React from "react"

const toneClasses = {
  cyan: {
    text: "text-[#1d4ed8]",
    icon: "text-[#2563EB]",
    border: "border-[#2563EB]/30",
    bg: "bg-[#2563EB]/10",
    dot: "bg-[#2563EB]",
  },
  green: {
    text: "text-[#147a56]",
    icon: "text-[#20A875]",
    border: "border-[#20A875]/35",
    bg: "bg-[#20A875]/10",
    dot: "bg-[#20A875]",
  },
  orange: {
    text: "text-[#b94600]",
    icon: "text-[#F96302]",
    border: "border-[#F96302]/35",
    bg: "bg-[#F96302]/10",
    dot: "bg-[#F96302]",
  },
  zinc: {
    text: "text-[#334155]",
    icon: "text-[#475569]",
    border: "border-slate-300",
    bg: "bg-slate-100",
    dot: "bg-[#475569]",
  },
}

const nodeToneClasses = {
  blue: "mc-system-node-blue",
  green: "mc-system-node-green",
  orange: "mc-system-node-orange",
  purple: "mc-system-node-purple",
}

const diagramPositions = [
  "sm:left-[7%] sm:top-[8%]",
  "sm:left-1/2 sm:top-[5%] sm:-translate-x-1/2",
  "sm:right-[7%] sm:top-[8%]",
  "sm:left-[3%] sm:top-1/2 sm:-translate-y-1/2",
  "sm:right-[3%] sm:top-1/2 sm:-translate-y-1/2",
  "sm:left-[10%] sm:bottom-[7%]",
  "sm:left-1/2 sm:bottom-[5%] sm:-translate-x-1/2",
  "sm:right-[10%] sm:bottom-[7%]",
]

export function PageShell({ children, className = "" }) {
  return <main className={`mc-page ${className}`}>{children}</main>
}

export function PageContainer({ children, className = "" }) {
  return (
    <div className={`relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-12 ${className}`}>
      {children}
    </div>
  )
}

export function PresentationPanel({
  children,
  className = "",
  as: Component = "section",
  ...props
}) {
  return (
    <Component className={`mc-presentation-panel ${className}`} {...props}>
      {children}
    </Component>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  tone = "light",
  className = "",
}) {
  const alignment = align === "center" ? "mx-auto text-center" : ""
  const isDark = tone === "dark"
  const titleClass = isDark ? "text-white" : "text-[#0B1220]"
  const descriptionClass = isDark ? "text-slate-300" : "text-slate-600"

  return (
    <header className={`mb-8 ${alignment} ${className}`}>
      {eyebrow ? <p className="mc-eyebrow">{eyebrow}</p> : null}
      <div className={align === "center" ? "mx-auto max-w-3xl" : "max-w-4xl"}>
        <h1 className={`text-4xl font-black leading-tight sm:text-5xl ${titleClass}`}>
          {title}
        </h1>
        {description ? (
          <p className={`mt-4 max-w-3xl text-base leading-relaxed sm:text-lg ${descriptionClass}`}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </header>
  )
}

export function StatusBadge({ children, tone = "green", className = "" }) {
  const toneClass = toneClasses[tone] ?? toneClasses.green

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border ${toneClass.border} ${toneClass.bg} px-3 py-1 text-xs font-bold ${toneClass.text} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${toneClass.dot}`} />
      {children}
    </span>
  )
}

export function SignalCard({
  label,
  title,
  detail,
  tone = "orange",
  className = "",
}) {
  const toneClass = toneClasses[tone] ?? toneClasses.orange

  return (
    <article className={`mc-signal-card ${className}`}>
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${toneClass.text}`}>
        {label}
      </p>
      <h3 className="mt-4 text-xl font-black leading-tight text-white">{title}</h3>
      {detail ? <p className="mt-3 text-sm leading-relaxed text-slate-300">{detail}</p> : null}
    </article>
  )
}

export function MetricTile({
  value,
  label,
  detail,
  icon: Icon,
  tone = "cyan",
  className = "",
}) {
  const toneClass = toneClasses[tone] ?? toneClasses.cyan

  return (
    <div className={`mc-panel p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        {Icon ? <Icon className={`h-5 w-5 ${toneClass.icon}`} aria-hidden="true" /> : null}
        <span className={`h-px flex-1 ${toneClass.bg}`} aria-hidden="true" />
      </div>
      <p className={`text-3xl font-black leading-none ${toneClass.text}`}>{value}</p>
      <p className="mt-2 text-sm font-bold text-[#0B1220]">{label}</p>
      {detail ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{detail}</p> : null}
    </div>
  )
}

export function ImpactBand({
  items,
  className = "",
  surface = "light",
}) {
  const isDark = surface === "dark"

  return (
    <section
      aria-label="Impact metrics"
      className={`mc-impact-band ${isDark ? "mc-impact-band-dark" : ""} ${className}`}
    >
      {items.map((item, index) => (
        <div
          key={`${item.value}-${item.label}`}
          className={`min-w-0 px-0 py-4 sm:px-5 ${
            index > 0 ? "border-t border-current/15 sm:border-l sm:border-t-0" : ""
          }`}
        >
          <p className={item.tone === "orange" ? "mc-impact-value-orange" : "mc-impact-value"}>
            {item.value}
          </p>
          <p className={isDark ? "mt-2 text-sm font-black uppercase text-slate-300" : "mt-2 text-sm font-black uppercase text-slate-700"}>
            {item.label}
          </p>
          {item.detail ? (
            <p className={isDark ? "mt-2 text-sm leading-relaxed text-slate-400" : "mt-2 text-sm leading-relaxed text-slate-600"}>
              {item.detail}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  )
}

export function StackChips({ items, className = "" }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => (
        <span key={item} className="mc-chip">
          {item}
        </span>
      ))}
    </div>
  )
}

export function SystemDiagram({
  centerLabel,
  centerDetail,
  nodes,
  caption,
  className = "",
}) {
  const visibleNodes = nodes.slice(0, diagramPositions.length)

  return (
    <figure className={`mc-system-diagram ${className}`}>
      <div className="relative z-10 grid grid-cols-2 gap-3 sm:block sm:min-h-[24rem]">
        <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
          <span className="mc-system-link left-[28%] top-[29%] w-[20%] rotate-[34deg]" />
          <span className="mc-system-link right-[28%] top-[29%] w-[20%] -rotate-[34deg]" />
          <span className="mc-system-link left-[24%] top-1/2 w-[24%]" />
          <span className="mc-system-link right-[24%] top-1/2 w-[24%]" />
          <span className="mc-system-link bottom-[28%] left-[28%] w-[20%] -rotate-[34deg]" />
          <span className="mc-system-link bottom-[28%] right-[28%] w-[20%] rotate-[34deg]" />
          <span className="mc-system-link left-1/2 top-[29%] w-[18%] -translate-x-1/2 rotate-90" />
          <span className="mc-system-link bottom-[29%] left-1/2 w-[18%] -translate-x-1/2 rotate-90" />
        </div>

        <div className="mc-system-hub col-span-2 sm:absolute sm:left-1/2 sm:top-1/2 sm:w-[12.5rem] sm:-translate-x-1/2 sm:-translate-y-1/2">
          {centerDetail ? (
            <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-[#FFB077]">
              {centerDetail}
            </p>
          ) : null}
          <p className="mt-2 text-xl font-black leading-tight text-white">{centerLabel}</p>
        </div>

        {visibleNodes.map((node, index) => {
          const Icon = node.icon
          const toneClass = nodeToneClasses[node.tone] ?? nodeToneClasses.blue

          return (
            <div
              key={`${node.label}-${index}`}
              className={`mc-system-node ${toneClass} sm:absolute sm:w-[8.6rem] ${diagramPositions[index]}`}
            >
              {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
              <p className="mt-3 text-sm font-black leading-tight text-white">{node.label}</p>
              {node.detail ? (
                <p className="mt-1 text-xs font-bold leading-snug text-slate-300">
                  {node.detail}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      {caption ? (
        <figcaption className="relative z-10 mt-4 border-t border-white/10 pt-4 text-sm font-bold leading-relaxed text-slate-300">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
