import { FaEnvelope, FaGithub, FaLinkedin } from "react-icons/fa";
import { socialLinks } from "../data/profile";

const socialIconById = {
  linkedin: FaLinkedin,
  github: FaGithub,
  email: FaEnvelope,
};

const socialClassById = {
  linkedin: "bg-blue-600 hover:bg-blue-700",
  github: "bg-gray-800 hover:bg-gray-900",
  email: "bg-gray-800 hover:bg-gray-900",
};

function SocialLinks({ className = "flex flex-wrap justify-center gap-3" }) {
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
            className={`${socialClassById[link.id]} text-white font-bold py-2 px-4 rounded inline-flex items-center`}
          >
            <Icon className="mr-2" />
            {link.label}
          </a>
        );
      })}
    </div>
  );
}

export default SocialLinks;
