/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        ink: "#07111f",

        panel: "#0d1a2b",

        panel2: "#101f33",

        line: "#1c3048",

        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
      },
    },
  },

  plugins: [],
};