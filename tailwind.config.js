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
          DEFAULT: '#8b5cf6', // violet-500
          light: '#ede9fe', // violet-100
          dark: '#6d28d9', // violet-700
        }
      }
    },
  },
  plugins: [],
}