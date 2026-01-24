import { NavLink } from "react-router-dom";

function Navbar() {
  return (
    <div className="w-full bg-[#6493bb] px-6 py-2">
      <div className='flex flex-row justify-start gap-4 items-center text-base font-["Cambria",_serif]'>
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
          to="/Projects"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Projects
        </NavLink>

        <NavLink
          to="/Experience"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Experience
        </NavLink>

        <NavLink
          to="/Resume"
          className={({ isActive }) =>
            isActive
              ? "text-slate-100 font-bold underline"
              : "font-bold text-slate-900 hover:text-slate-100"
          }
        >
          Resume
        </NavLink>

        <NavLink
          to="/Contact"
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
