export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 24px 80px rgba(255, 128, 0, 0.12)',
      },
      colors: {
        primary: '#ff7a18',
        warm: '#ff9f43',
        accent: '#ffb47b',
      },
      fontFamily: {
        sans: ['Kanit', 'Noto Sans Thai', 'Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
