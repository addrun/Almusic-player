/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 强调色（动态，从封面取色注入）
        primary: {
          DEFAULT: 'var(--accent-color, #888888)',
          light: 'var(--accent-color-light, #9c9c9c)',
          dark: 'var(--accent-color-dark, #747474)'
        },
        secondary: {
          DEFAULT: '#6c757d',
          light: '#8c959e',
          dark: '#495057'
        },
        // 固定明暗色（配合 dark: 变体使用，不随主题变化）
        dark: {
          DEFAULT: '#000',
          100: '#161616',
          200: '#2d2d2d',
          300: '#3d3d3d'
        },
        light: {
          DEFAULT: '#fff',
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6'
        },
        // 设计令牌驱动的语义色（自动适配主题）
        surface: {
          DEFAULT: 'var(--d-surface, #ffffff)',
          alt: 'var(--d-surface-alt, #f8f9fa)',
          hover: 'var(--d-surface-hover, #f1f3f5)',
          active: 'var(--d-surface-active, #e9ecef)'
        },
        card: {
          DEFAULT: 'var(--d-card, #ffffff)',
          hover: 'var(--d-card-hover, #f8f9fa)'
        },
        // 设计令牌驱动的文字色
        content: {
          primary: 'var(--d-text-primary, #1a1a1a)',
          secondary: 'var(--d-text-secondary, #495057)',
          muted: 'var(--d-text-muted, #868e96)'
        },
        // 设计令牌驱动的边框色
        'border-default': 'var(--d-border, #e9ecef)',
        'border-light': 'var(--d-border-light, #f1f3f5)',
        'border-strong': 'var(--d-border-strong, #dee2e6)',
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: 'var(--accent-color, #888888)',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16'
        }
      },
      borderRadius: {
        'd-xs': 'var(--d-radius-xs, 4px)',
        'd-sm': 'var(--d-radius-sm, 8px)',
        'd-md': 'var(--d-radius-md, 12px)',
        'd-lg': 'var(--d-radius-lg, 16px)',
        'd-xl': 'var(--d-radius-xl, 20px)',
        'd-2xl': 'var(--d-radius-2xl, 24px)',
        'd-full': 'var(--d-radius-full, 9999px)'
      },
      boxShadow: {
        'primary': '0 4px 14px 0 var(--accent-color, #888888)',
        'primary-sm': '0 2px 7px 0 var(--accent-color, #888888)',
        'primary-lg': '0 10px 25px 0 var(--accent-color, #888888)',
        'd-sm': 'var(--d-shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
        'd-md': 'var(--d-shadow-md, 0 4px 12px rgba(0,0,0,0.06))',
        'd-lg': 'var(--d-shadow-lg, 0 8px 24px rgba(0,0,0,0.08))',
        'd-xl': 'var(--d-shadow-xl, 0 16px 48px rgba(0,0,0,0.1))'
      },
      fontFamily: {
        'd-sans': 'var(--d-font-sans, sans-serif)',
        'd-serif': 'var(--d-font-serif, serif)',
        'd-mono': 'var(--d-font-mono, monospace)'
      },
      fontSize: {
        'd-xs': ['var(--d-text-xs, 0.75rem)', { lineHeight: '1.25' }],
        'd-sm': ['var(--d-text-sm, 0.875rem)', { lineHeight: '1.375' }],
        'd-base': ['var(--d-text-base, 1rem)', { lineHeight: '1.5' }],
        'd-lg': ['var(--d-text-lg, 1.125rem)', { lineHeight: '1.625' }],
        'd-xl': ['var(--d-text-xl, 1.25rem)', { lineHeight: '1.75' }],
        'd-2xl': ['var(--d-text-2xl, 1.5rem)', { lineHeight: '1.875' }],
        'd-3xl': ['var(--d-text-3xl, 1.875rem)', { lineHeight: '2.25rem' }]
      },
      transitionTimingFunction: {
        'd-out': 'var(--d-ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
        'd-in-out': 'var(--d-ease-in-out, cubic-bezier(0.77, 0, 0.175, 1))',
        'd-spring': 'var(--d-ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1))',
        'd-drawer': 'var(--d-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1))'
      },
      transitionDuration: {
        'd-instant': 'var(--d-duration-instant, 75ms)',
        'd-fast': 'var(--d-duration-fast, 125ms)',
        'd-normal': 'var(--d-duration-normal, 200ms)',
        'd-slow': 'var(--d-duration-slow, 300ms)',
        'd-slower': 'var(--d-duration-slower, 500ms)'
      },
      zIndex: {
        'd-dropdown': 'var(--d-z-dropdown, 1000)',
        'd-sticky': 'var(--d-z-sticky, 1100)',
        'd-fixed': 'var(--d-z-fixed, 1200)',
        'd-modal-backdrop': 'var(--d-z-modal-backdrop, 1300)',
        'd-modal': 'var(--d-z-modal, 1400)',
        'd-popover': 'var(--d-z-popover, 1500)',
        'd-tooltip': 'var(--d-z-tooltip, 1600)',
        'd-toast': 'var(--d-z-toast, 1700)',
        'd-notification': 'var(--d-z-notification, 1800)'
      },
      ringColor: {
        primary: 'var(--accent-color, #888888)',
      },
      ringWidth: {
        primary: '2px',
      },
      borderColor: {
        DEFAULT: 'var(--d-border, #e9ecef)'
      }
    }
  },
  plugins: []
};
