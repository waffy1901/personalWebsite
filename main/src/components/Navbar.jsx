import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/experience", label: "Experience" },
  { to: "/case-studies", label: "Case Studies" },
  { to: "/resume", label: "Resume" },
  { to: "/contact", label: "Contact" },
];

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/10 bg-[#F4F1EA]/92 px-4 py-3 shadow-[0_12px_30px_rgba(11,18,32,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <NavLink
          to="/"
          className="group inline-flex items-center gap-3 text-[#0B1220] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
          aria-label="Waffy Ahmed home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#0B1220] bg-[#0B1220] font-black text-white transition group-hover:border-[#F96302] group-hover:bg-[#F96302]">
            WA
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black">Waffy Ahmed</span>
            <span className="block text-xs font-bold text-slate-500">Platform reliability engineer</span>
          </span>
        </NavLink>

        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "group relative py-1.5 text-slate-600 transition hover:text-[#0B1220] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2",
                  isActive
                    ? "active text-[#0B1220]"
                    : "",
                ].join(" ")
              }
            >
              {item.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left scale-x-0 bg-[#F96302] transition group-hover:scale-x-100 group-[.active]:scale-x-100" />
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
