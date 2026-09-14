/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        skillwill: {
          primary: '#3b82f6',
          dark: '#1e40af',
          light: '#dbeafe',
        },
      },
    },
  },
  plugins: [],
};
