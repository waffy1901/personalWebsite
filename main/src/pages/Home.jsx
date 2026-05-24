import React, { useLayoutEffect, useRef, useState } from "react";
import profilePicture from "../images/profilePic.jpg";
import { FaLinkedin, FaGithub, FaEnvelope, FaDownload } from "react-icons/fa";
import gtLogo from "../images/gtLogo.png";
import DeployDates from "../components/DeployDates";

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
            <img src={gtLogo} alt="Georgia Tech Logo" className="h-16 w-auto" />
          </div>
          <div className="flex-grow text-center mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-700">Waffy Ahmed</h1>
            <p className="text-xl text-gray-700">
              Software Engineer | Georgia Tech
            </p>
          </div>
          <div className="mb-4 sm:mb-0">
            <a
              href="/waffyAhmedResume.pdf"
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
                  I&apos;m a Software Engineer at The Home Depot, owning operational
                  health across 60+ repositories that support
                  transaction-critical services. My work focuses on Kubernetes
                  autoscaling, deployment automation, observability, and
                  incident response for high-throughput systems processing
                  millions of transactions daily. Previously, I interned at The Home
                  Depot twice and led a team of six building a data reconciliation
                  platform for the CDC. I&apos;m a Georgia Tech graduate focused on
                  reliability engineering and building systems that don’t page
                  you at 2 AM.
                </p>
              </div>

              <div className="w-full md:w-1/2 flex justify-center items-start -mt-2">
                <img
                  src={profilePicture}
                  alt="Waffy Ahmed"
                  className="w-auto max-w-full object-cover rounded-lg shadow-lg"
                  style={introHeight ? { height: `${introHeight}px` } : undefined}
                />
              </div>
            </div>

            <div className="flex flex-col items-center mt-4">
              <p className="text-lg font-bold leading-relaxed text-gray-700 mb-2">
                Connect with me
              </p>
              <div className="flex justify-center space-x-4">
                <a
                  href="https://www.linkedin.com/in/wa24/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center"
                >
                  <FaLinkedin className="mr-2" />
                  LinkedIn
                </a>
                <a
                  href="https://github.com/waffy1901"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded inline-flex items-center"
                >
                  <FaGithub className="mr-2" />
                  GitHub
                </a>
                <a
                  href="mailto:waffyahmed@gmail.com"
                  className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded inline-flex items-center"
                >
                  <FaEnvelope className="mr-2" />
                  Email
                </a>
              </div>
            </div>
            <DeployDates first="2024-09-13T19:43:00Z" />
          </section>
        </div>
      </main>
    </div>
  );
}
export default Home;
