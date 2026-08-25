import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router";
import { createRouteIntentHandlers } from "../utils/routePrefetch.js";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/projects/", label: "Projects" },
  { to: "/experience/", label: "Experience" },
  { to: "/case-studies/", label: "Case Studies", shortLabel: "Cases" },
  { to: "/resume/", label: "Resume" },
  { to: "/contact/", label: "Contact" },
];

const desktopNavMediaQuery = "(min-width: 640px)";
const focusRingClearance = 6;

function revealNavItem(nav, link, behavior) {
  if (
    !nav ||
    !link ||
    typeof window === "undefined" ||
    !window.matchMedia ||
    window.matchMedia(desktopNavMediaQuery).matches
  ) {
    return;
  }

  const navRect = nav.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const visibleLeft = navRect.left + focusRingClearance;
  const visibleRight = navRect.right - focusRingClearance;

  if (linkRect.left >= visibleLeft && linkRect.right <= visibleRight) {
    return;
  }

  const scrollOffset =
    linkRect.left < visibleLeft
      ? linkRect.left - visibleLeft
      : linkRect.right - visibleRight;
  const left = Math.max(0, nav.scrollLeft + scrollOffset);

  if (typeof nav.scrollTo === "function") {
    nav.scrollTo({ behavior, left });
  } else {
    nav.scrollLeft = left;
  }
}

function Navbar() {
  const location = useLocation();
  const navRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const nav = navRef.current;
    const activeLink = nav?.querySelector("[aria-current='page']");

    if (!activeLink || window.matchMedia(desktopNavMediaQuery).matches) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    revealNavItem(nav, activeLink, prefersReducedMotion ? "auto" : "smooth");
  }, [location.pathname]);

  const handleFocusCapture = (event) => {
    const focusedLink = event.target.closest?.("a");

    if (focusedLink && navRef.current?.contains(focusedLink)) {
      revealNavItem(navRef.current, focusedLink, "auto");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/10 bg-[#F4F1EA]/92 px-4 py-3 shadow-[0_12px_30px_rgba(11,18,32,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <NavLink
          to="/"
          className="group inline-flex items-center gap-3 text-[#0B1220] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
          aria-label="Waffy Ahmed home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#0B1220] bg-[#0B1220] font-black text-white transition group-hover:border-[#F96302] group-hover:bg-[#F96302] group-hover:text-[#0B1220]">
            WA
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black">Waffy Ahmed</span>
            <span className="block text-xs font-bold text-slate-600">Platform reliability engineer</span>
          </span>
        </NavLink>

        <div className="flex min-w-0 items-center gap-1 sm:block">
          <nav
            ref={navRef}
            aria-label="Primary navigation"
            onFocusCapture={handleFocusCapture}
            className="-mx-1 flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto px-2 py-1.5 text-xs font-bold whitespace-nowrap [scrollbar-width:none] sm:mx-0 sm:flex-none sm:flex-wrap sm:justify-end sm:gap-x-4 sm:overflow-visible sm:px-0 sm:py-0 sm:text-sm sm:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                {...createRouteIntentHandlers(item.to)}
                className={({ isActive }) =>
                  [
                    "group relative shrink-0 rounded-md px-2 py-1.5 text-slate-600 transition hover:bg-[#0B1220]/5 hover:text-[#0B1220] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 sm:rounded-none sm:px-0 sm:hover:bg-transparent",
                    isActive
                      ? "active text-[#0B1220]"
                      : "",
                  ].join(" ")
                }
              >
                {item.shortLabel ? (
                  <>
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
                <span className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left scale-x-0 bg-[#F96302] transition group-hover:scale-x-100 group-[.active]:scale-x-100" />
              </NavLink>
            ))}
          </nav>
          <span
            aria-hidden="true"
            className="pointer-events-none shrink-0 rounded-full border border-slate-900/15 px-1.5 py-1 text-[10px] font-bold text-slate-600 sm:hidden"
          >
            More -&gt;
          </span>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
