/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F3EFE6',
          2: '#EAE5D8',
        },
        surface: '#FBF9F4',
        ink: {
          DEFAULT: '#1D1B16',
          2: '#4A463C',
          3: '#7B7566',
        },
        rule: '#D5CEBD',
        hyp: {
          noise: '#8A8574',
          sensor: '#B7791F',
          isolated: '#1F6F8B',
          cascade: '#D9421C',
        },
        act: {
          watch: '#4A463C',
          prepare: '#B7791F',
          alert: '#D9631C',
          escalate: '#A3121F',
        },
        stat: {
          ok: '#3F7D58',
          warn: '#B7791F',
          bad: '#A3121F',
        }
      },
      fontFamily: {
        serif: ['"Newsreader"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '2px',
        lg: '2px',
        xl: '2px',
      },
    },
  },
  plugins: [],
}
