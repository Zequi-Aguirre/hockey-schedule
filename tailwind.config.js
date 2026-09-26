/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B2C5A',
          gold: '#F5A81C',
          columbia: '#8FCBE8',
        },
      },
    },
  },
  plugins: [],
}

