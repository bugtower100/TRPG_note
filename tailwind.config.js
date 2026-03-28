/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb', // blue-600
          light: '#dbeafe', // blue-100
          dark: '#1e40af', // blue-800
        }
      }
    },
  },
  plugins: [],
}