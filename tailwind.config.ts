import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

// Dream Smiles Dental brand palette
// eggshell, cream, sand, faded moss, dark slate
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // DSD palette
        eggshell: '#F1EFE9',
        cream: '#ECDFD2',
        sand: '#D2C6B5',
        moss: '#A19F92',
        slate: '#39393B',

        // Semantic tokens (used by shadcn/ui)
        background: '#F1EFE9',
        foreground: '#39393B',
        muted: {
          DEFAULT: '#ECDFD2',
          foreground: '#A19F92',
        },
        border: '#D2C6B5',
        input: '#D2C6B5',
        ring: '#39393B',
        primary: {
          DEFAULT: '#39393B',
          foreground: '#F1EFE9',
        },
        secondary: {
          DEFAULT: '#D2C6B5',
          foreground: '#39393B',
        },
        accent: {
          DEFAULT: '#ECDFD2',
          foreground: '#39393B',
        },
        destructive: {
          DEFAULT: '#8B3A3A',
          foreground: '#F1EFE9',
        },
        // Confidence indicators for extraction screen
        confidence: {
          high: '#5C8A5C', // green-ish
          medium: '#C99A4B', // amber-ish
          low: '#8B3A3A', // red-ish
        },
      },
      fontFamily: {
        // DM Sans is the agreed substitute for Adobe Area Normal
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
