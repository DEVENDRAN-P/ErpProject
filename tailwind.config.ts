import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        page: '#F8FAFC',
        card: '#FFFFFF',
        sidebar: '#FFFFFF',
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: '#EFF6FF',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          500: '#2563EB',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        accent: {
          green: '#047857',
          'green-light': '#ECFDF5',
          amber: '#B45309',
          'amber-light': '#FFFBEB',
          red: '#B91C1C',
          'red-light': '#FEF2F2',
          gray: '#475569',
          'gray-light': '#F1F5F9',
        },
      },
      borderRadius: {
        'card': '10px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
