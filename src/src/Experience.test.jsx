import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Experience from './pages/Experience';

jest.mock('./components/ExperienceCard', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid="experience-card">
      <span>{props.title}</span>
      <span>{props.company}</span>
    </div>
  ),
}));

describe('Experience Component', () => {
  it('renders both Work and Extracurricular sections', () => {
    render(
      <MemoryRouter>
        <Experience />
      </MemoryRouter>
    );
    expect(screen.getByText(/Work Experience/i)).toBeInTheDocument();
    expect(screen.getByText(/Extracurricular Experience/i)).toBeInTheDocument();
  });

  it('renders correct number of ExperienceCards for work', () => {
    render(
      <MemoryRouter>
        <Experience />
      </MemoryRouter>
    );
    const workCards = screen.getAllByTestId('experience-card').filter(card =>
      card.textContent.includes('The Home Depot') || card.textContent.includes('Landis+Gyr')
    );
    expect(workCards.length).toBe(4);
  });

  it('renders correct number of ExperienceCards for extracurricular', () => {
    render(
      <MemoryRouter>
        <Experience />
      </MemoryRouter>
    );
    const extraCards = screen.getAllByTestId('experience-card').filter(card =>
      card.textContent.includes('Fintech') || card.textContent.includes('Centers for Disease Control') || 
      card.textContent.includes('Georgia Tech')
    );
    expect(extraCards.length).toBe(3);
  });

  it('applies centerIndex classes correctly in extracurricular grid', () => {
    render(
      <MemoryRouter>
        <Experience />
      </MemoryRouter>
    );
    const centeredCardContainer = document.querySelector('.md\\:col-span-2.flex.justify-center');
    expect(centeredCardContainer).toBeInTheDocument();
    expect(centeredCardContainer.textContent).toMatch(/Georgia Tech College of Computing/);
  });
});