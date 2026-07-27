/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1C1B1A',
        surface: '#242322',
        raised: '#2E2C2A',
        ink: '#EDEAE4',
        muted: '#9C9890',
        accent: '#E8B04B',
        accentSoft: 'rgba(232,176,75,0.15)',
        line: '#3A3835'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      }
    }
  },
  plugins: []
};
