import { FaEnvelope, FaGithub, FaLinkedin } from "react-icons/fa";
import { socialLinks } from "../data/profile";
import { trackLinkClick } from "../utils/analytics";

const socialIconById = {
  linkedin: FaLinkedin,
  github: FaGithub,
  email: FaEnvelope,
};

const socialClassById = {
  linkedin: "border-[#2563EB]/30 bg-[#2563EB]/10 text-[#1d4ed8] hover:bg-[#2563EB]/15",
  github: "border-slate-300 bg-white text-[#0B1220] hover:bg-[#E8EDF2]",
  email: "border-[#F96302]/30 bg-[#F96302]/10 text-[#b94600] hover:bg-[#F96302]/15",
};

function SocialLinks({
  className = "flex flex-wrap justify-center gap-3",
  placement = "social_links",
}) {
  return (
    <div className={className}>
      {socialLinks.map((link) => {
        const Icon = socialIconById[link.id];
        return (
          <a
            key={link.id}
            href={link.href}
            {...(link.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            onClick={() =>
              trackLinkClick("social_link_click", {
                href: link.href,
                label: link.label,
                placement,
                social_platform: link.id,
              })
            }
            className={`${socialClassById[link.id]} inline-flex items-center rounded-md border px-3 py-2 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2`}
          >
            <Icon className="mr-2" aria-hidden="true" />
            {link.label}
          </a>
        );
      })}
    </div>
  );
}

export default SocialLinks;
