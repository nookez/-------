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
module.exports = {
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    }
  }
}