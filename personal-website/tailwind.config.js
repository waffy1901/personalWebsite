/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        'cambria': ['Cambria', 'Cochin', 'Georgia', 'Times', 'Times New Roman', 'serif'],
      },
  },
},
  variants: {},
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.backface-hidden': {
          'backface-visibility': 'hidden',
        },
        '.perspective': {
          'perspective': '1000px',
        },
        '.transform-style-preserve-3d': {
          'transform-style': 'preserve-3d',
        },
        '.rotate-y-180': {
          transform: 'rotateY(180deg)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}