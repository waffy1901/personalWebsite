import React from "react";
import ExperienceCard from "../components/ExperienceCard";
import OwnershipCard from "../components/OwnershipCard";
import { HiCog, HiLockClosed, HiServer, HiShieldCheck } from "react-icons/hi";
import {
  experiencePage,
  extracurricularExperiences,
  ownershipAreas,
  workExperiences,
} from "../data/experience";

const ownershipIconById = {
  server: HiServer,
  shield: HiShieldCheck,
  lock: HiLockClosed,
  cog: HiCog,
};

const ExperienceGrid = ({ experiences, isExtracurricular, centerIndex }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {experiences.map((exp, index) => (
        <div
          key={exp.id}
          className={`w-full ${
            index === centerIndex ? "md:col-span-2 flex justify-center" : ""
          }`}
        >
          <div
            className={`w-full ${
              index === centerIndex ? "md:w-3/4 lg:w-1/2" : ""
            }`}
          >
            <ExperienceCard {...exp} isExtracurricular={isExtracurricular} />
          </div>
        </div>
      ))}
    </div>
  );
};

function Experience() {
  return (
    <div className="bg-blue-300 min-h-screen py-4 font-cambria">
      <div className="max-w-6xl mx-auto px-4 space-y-10">
        <section>
          <h1 className="text-3xl text-center font-bold mb-6">
            {experiencePage.workHeading}
          </h1>

          <ExperienceGrid
            experiences={workExperiences}
            isExtracurricular={false}
          />
        </section>

        <section>
          <h2 className="text-3xl text-center font-bold mb-2">
            {experiencePage.ownershipHeading}
          </h2>
          <p className="text-center text-gray-600 text-sm mb-8">
            {experiencePage.ownershipEyebrow}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {ownershipAreas.map((area) => {
              const Icon = ownershipIconById[area.icon];
              return (
                <OwnershipCard
                  key={area.id}
                  icon={<Icon className="text-blue-600" />}
                  title={area.title}
                  summary={area.summary}
                  details={area.details}
                />
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-3xl text-center font-bold mb-8">
            {experiencePage.extracurricularHeading}
          </h2>

          <ExperienceGrid
            experiences={extracurricularExperiences}
            isExtracurricular={true}
            centerIndex={experiencePage.centeredExtracurricularIndex}
          />
        </section>
      </div>
    </div>
  );
}

export default Experience;
