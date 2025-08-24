import React from "react";
import ExperienceCard from "../components/ExperienceCard";
import hdLogo from "../images/hdLogo.png";
import landisGyrLogo from "../images/landisGyrLogo.png";
import fintechGTLogo from "../images/fintechGTLogo.png";
import cdcLogo from "../images/cdcLogo.png";
import gtComputingLogo from "../images/gtComputingLogo.png";

const ExperienceGrid = ({ experiences, isExtracurricular, centerIndex }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {experiences.map((exp, index) => (
        <div 
          key={index} 
          className={`w-full ${
            index === centerIndex 
              ? 'md:col-span-2 flex justify-center' 
              : ''
          }`}
        >
          <div className={`w-full ${
            index === centerIndex 
              ? 'md:w-3/4 lg:w-1/2' 
              : ''
          }`}>
            <ExperienceCard {...exp} isExtracurricular={isExtracurricular} />
          </div>
        </div>
      ))}
    </div>
  );
};

function Experience() {
  const workExperiences = [
    {
      title: "Software Engineer",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "January 2025 - Present",
      bullets: [
        "Automated Spinnaker deployment pipelines for 10+ microservices with cdk8s, utilizing TypeScript, Terraform, and Google Cloud Platform for production and non-production environments, reducing deployment times by 25%.",
        "Resolved critical transaction processing/lookup issues across 500+ stores, collaborating with cross-functional teams and leveraging Cassandra, Elasticsearch, Java, BigQuery and Postman to maintain ∼100% service availability.",
        "Reduced lookup latency by 5% in a high-throughput system (10 million lookups per day) through a scalable, bucketed Elasticsearch indexing method using Java, enabling distributed lookups via partitioned indices.",
        "Improved operational responsiveness by decreasing alert acknowledgement times 30% via optimizing tiered alerting and Grafana dashboards across 20+ microservices, automating escalation via Slack and PagerDuty integrations.",
        "Led testing and validation to disable a legacy service component handling ∼27% of transaction volume (14.5 million daily captures/lookups) using BigQuery and Postman, supporting a phased retirement effort involving 12 teams."
      ],
      logo: hdLogo,
      color: "bg-[#FFA500]"
    },
    {
      title: "Software Engineer Intern",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "May 2024 - July 2024",
      bullets: [
        "Developed an internal product information page for cashiers, streamlining self-checkout processes and reducing customer wait times for associate intervention by ~25%.",
        "Leveraged Java to obtain germane product data, used React and TypeScript to effectively display product information for all registers at self-checkout, pruning customer theft by ∼$10 million annually."
      ],
      logo: hdLogo,
      color: "bg-[#FFA500]"
    },
    {
      title: "Software Engineer Intern",
      company: "The Home Depot",
      location: "Atlanta, GA",
      date: "May 2023 - July 2023",
      bullets: [
        "Optimized the efficiency of configuring 40,000+ registers across 2,300 stores by 90%, in collaboration with 2 interns.",
        "Truncated the maximum deployment time of updates to registers from 24+ hours to 30 minutes, leveraging the HttpClient and Flow Java libraries to streamline the retrieval of polymorphic external configurations.",
        "Collaborated with cross-functional teams, including the UI/UX team, designing and constructing user interface components for a new configuration process - utilizing React, Next.js, and TypeScript."
      ],
      logo: hdLogo,
      color: "bg-[#FFA500]"
    },
    {
      title: "Firmware Engineer Intern",
      company: "Landis+Gyr",
      location: "Alpharetta, GA",
      date: "May 2022 - August 2022",
      bullets: [
        "Accelerated the process of converting DCW (Data Control Words) hexadecimal values to their corresponding ASCII representations by ∼50% through efficient Python practices.",
        "Bolstered data transmission efficiency by ∼25%, collaborating with a software architect to conduct comprehensive testing of collectors and debugging of various Python scripts employing MySQL."
      ],
      logo: landisGyrLogo,
      color: "bg-white bg-opacity-100"
    },
  ];

  const extracurricularExperiences = [
    {
      title: "Frontend Engineer",
      company: "Fintech @ Georgia Tech",
      location: "Atlanta, GA",
      date: "September 2024 - November 2024",
      bullets: [
        "Reduced page load times by ∼35% via transforming a multi-page credit card website into a React-based single-page application, streamlining card wallet management and adding a card removal feature for authenticated users.",
        "Implemented a cart page for a React Native grocery application,  allowing users to add/remove items, adjust squantities, view real-time total costs, and integrated the Stripe API for streamlined in-app credit card payments.",
        "Leveraged an inbuilt API for image recognition, identifying and ranking the top 3 product matches for shopping carts."
      ],
      logo: fintechGTLogo,
      color: "bg-[#FFD700] bg-opacity-70"
    },
    {
      title: "Project Manager & Full-Stack Software Developer",
      company: "Centers for Disease Control and Prevention",
      location: "Atlanta, GA",
      date: "August 2023 - April 2024",
      bullets: [
        "Oversaw a team of 6 to automate the reconciliation of case counts for infectious diseases between 50 state health departments and the CDC, alongside doubling as a full-stack software developer.",
        "Utilized Python to compare state health department and CDC data, highlighting any discrepancies between the two datasets, saving 5000+ hours of manual reconciliation annually.",
        "Leveraged React to visualize discrepancy statistics and disease-specific data, along with implementing an interactive discrepancy table filtering feature based on selected statistics.",
        "Procured feedback from CDC computer scientists and representatives from 25+ state health departments via application demonstrations and integrated the suggested modifications.",
        "Employed FastAPI to develop an endpoint for fetching discrepancy report statistics from a SQLite statistics table.",
        "Facilitated weekly team meetings, drove timely completion of tasks, ensured consistent team participation, and adhered to stringent deadlines under an agile framework.",
        "Constructed technical diagrams/documentation (Lo-Fi & Hi-Fi Prototypes, User Research, Minimum Marketable Features, Story Mapping, UX Report, and Detailed Design) to aid the development process.",
      ],
      logo: cdcLogo,
      color: "bg-white bg-opacity-100"
    },
    {
      title: "Undergraduate Teaching Assistant",
      company: "Georgia Tech College of Computing",
      location: "Atlanta, GA",
      date: "January 2023 - May 2023",
      bullets: [
        "Supervised and taught recitations for CS 3001 (Computing & Society) to 20+ students for 4+ hours per week.",
        "Evaluated assignments and exams, grading 20+ students and supplying targeted feedback to enhance performance.",
        "Fostered engagement by answering 105+ questions on Piazza, the student discussion forum."
      ],
      logo: gtComputingLogo,
      color: "bg-[#FFD700] bg-opacity-70"
    },
  ];

  return (
    <div className="bg-blue-300 min-h-screen py-4 font-cambria">
      <div className="max-w-6xl mx-auto px-4">
        <section className="mb-4">
          <h2 className="text-3xl text-center font-bold mb-4">Work Experience</h2>
          <ExperienceGrid 
            experiences={workExperiences} 
            isExtracurricular={false} 
          />
        </section>
        
        <section className="mb-4">
          <h2 className="text-3xl text-center font-bold mb-4 mt-16">Extracurricular Experience</h2>
          <ExperienceGrid 
            experiences={extracurricularExperiences} 
            isExtracurricular={true} 
            centerIndex={2}
          />
        </section>
      </div>
    </div>
  );
}
export default Experience;