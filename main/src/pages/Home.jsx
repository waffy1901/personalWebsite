import React, { useLayoutEffect, useRef, useState } from "react";
import { FaDownload } from "react-icons/fa";
import DeployDates from "../components/DeployDates";
import SocialLinks from "../components/SocialLinks";
import { deployInfo, profile, resume } from "../data/profile";

function Home() {
  const introRef = useRef(null);
  const [introHeight, setIntroHeight] = useState(null);

  useLayoutEffect(() => {
    const intro = introRef.current;
    if (!intro) return undefined;

    const updateIntroHeight = () => {
      setIntroHeight(Math.ceil(intro.getBoundingClientRect().height));
    };

    updateIntroHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateIntroHeight);
      return () => window.removeEventListener("resize", updateIntroHeight);
    }

    const resizeObserver = new ResizeObserver(updateIntroHeight);
    resizeObserver.observe(intro);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-cambria">
      <nav className="bg-blue-100 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center mb-4 sm:mb-0">
            <img
              src={profile.educationLogo}
              alt="Georgia Tech Logo"
              className="h-16 w-auto"
            />
          </div>
          <div className="flex-grow text-center mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-700">{profile.name}</h1>
            <p className="text-xl text-gray-700">
              {profile.tagline}
            </p>
          </div>
          <div className="mb-4 sm:mb-0">
            <a
              href={resume.pdf}
              download
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors inline-flex items-center"
            >
              <FaDownload className="mr-2" />
              Download Resume
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-grow bg-blue-100">
        <div className="container mx-auto px-4">
          <section className="py-12">
            <div className="flex flex-col md:flex-row justify-center items-start gap-8 max-w-4xl mx-auto">
              <div className="w-full md:w-1/2 flex-grow">
                <p ref={introRef} className="text-lg leading-relaxed text-gray-700">
                  {profile.intro}
                </p>
              </div>

              <div className="w-full md:w-1/2 flex justify-center items-start -mt-2">
                <img
                  src={profile.profilePicture}
                  alt={profile.name}
                  className="w-auto max-w-full object-cover rounded-lg shadow-lg"
                  style={introHeight ? { height: `${introHeight}px` } : undefined}
                />
              </div>
            </div>

            <div className="flex flex-col items-center mt-4">
              <p className="text-lg font-bold leading-relaxed text-gray-700 mb-2">
                Connect with me
              </p>
              <SocialLinks />
            </div>
            <DeployDates first={deployInfo.firstPublishedAt} />
          </section>
        </div>
      </main>
    </div>
  );
}
export default Home;
