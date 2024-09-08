import React from 'react';

function Home() {
  return (
    <div className='bg-gray-100 min-h-screen'>
      <header className='bg-[#f8fafc] text-gray-700 p-4'>
        <h1 className='text-3xl font-bold'>Waffy Ahmed</h1>
        <p className='text-xl'>Software Engineer | Georgia Tech</p>
      </header>
      <main className='container mx-auto'>
        <section className='p-6 bg-[#f8fafc] text-gray-700'>
          <p className='text-lg leading-relaxed'>
            I am a senior majoring in Computer Science at Georgia Tech, set to graduate in December 2024 with 
            my Bachelor's. I am a problem-solver at heart. As such, software engineering is a perfect fit for me. I have plenty of prior 
            experience. I have completed 3 internships, oversaw a team of 6 to automate a laborious and redundant task while also working as a full-stack 
            software developer, and am currently working as an engineer at Fintech @ Georgia Tech. For a more in-depth overview, check out
            the Experience page.
          </p>
        </section>
      </main>
    </div>
  );
}

export default Home;