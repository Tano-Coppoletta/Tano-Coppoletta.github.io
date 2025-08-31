/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Dark theme colors
        'bg': '#0f1115',
        'surface': '#151821',
        'text': '#e8ecf2',
        'muted': '#A6AEC1',
        'accent': '#39d98a',
        'link': '#7cc7ff',
        'stroke': '#212632',
        'focus': '#62f1b1',
      },
      fontFamily: {
        'mono': ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        'sans': ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'caret': 'caret 1s steps(1, end) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        caret: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      maxWidth: {
        'content': '880px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      }
    },
  },
  plugins: [],
}
