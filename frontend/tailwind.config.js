/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hedera: {
          purple: '#8B4FE0',
          blue: '#4EA8E0',
          green: '#4EE0B1',
        },
      },
    },
  },
  plugins: [],
}

