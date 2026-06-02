import { NavLink } from "react-router-dom";

function Navbar() {
  return (
    <div className="w-full bg-[#6493bb] px-4 py-2">
      <div className='flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm sm:text-base font-["Cambria",_serif]'>
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Home
        </NavLink>

        <NavLink
          to="/projects"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Projects
        </NavLink>

        <NavLink
          to="/experience"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Experience
        </NavLink>

        <NavLink
          to="/case-studies"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Case Studies
        </NavLink>

        <NavLink
          to="/resume"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Resume
        </NavLink>

        <NavLink
          to="/contact"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Contact
        </NavLink>
      </div>
    </div>
  );
}

export default Navbar;
