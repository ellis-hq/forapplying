/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        'border-light': 'var(--color-border-light)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
          muted: 'var(--color-accent-muted)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
          border: 'var(--color-success-border)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          light: 'var(--color-error-light)',
          border: 'var(--color-error-border)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
