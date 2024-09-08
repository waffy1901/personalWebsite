import React from 'react';

function App() {
  return (
    <div className='bg-gray-100'>
      <header className='bg-blue-600 text-white p-4'>
        <h1 className='text-3xl font-bold'>Waffy Ahmed</h1>
        <p className='text-xl'>Web Developer</p>
      </header>
      <main className='container mx-auto mt-8 p-4'>
        <section className='mb-8'>
          <h2 className='text-2xl font-semibold mb-4'>About Me</h2>
          <p className='text-gray-700'>Write a brief introduction about yourself here.</p>
        </section>
        <section>
          <h2 className='text-2xl font-semibold mb-4'>Projects</h2>
          <ul className='list-disc list-inside text-gray-700'>
            <li>Project 1</li>
            <li>Project 2</li>
            <li>Project 3</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;