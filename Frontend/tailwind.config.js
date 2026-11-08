/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Editorial Luxury Brand Tokens
        espresso: {
          DEFAULT: '#201A14',
          light: '#2D251E',
          muted: '#3D332B',
          deep: '#181410',
        },
        bronze: {
          DEFAULT: '#B99B73',
          hover: '#A58760',
          dark: '#8C6F47',
          light: '#D9C7B0',
          subtle: '#F4EFEA',
          gold: '#C8AC85',
        },
        porcelain: {
          DEFAULT: '#F6F1E8',
          subtle: '#FAF7F2',
          card: '#FFFFFF',
        },
        ivory: '#FBF9F5',
        stone: {
          DEFAULT: '#E9E3D9',
          light: '#F2EDE5',
          dark: '#D5C8B7',
        },
        taupe: '#D5C8B7',
        graphite: '#292722',
        mutedGrey: '#81796F',
        softBorder: '#E8E1D8',

        // Dark Mode Luxury Tokens
        'dark-bg': '#151311',
        'dark-surface': '#201C18',
        'dark-card': '#24201C',
        'dark-elevated': '#2B2621',
        'dark-border': '#332D26',
        'dark-muted': '#A39B90',

        // Backward compatibility mappings for existing crystal utility classes
        crystal: {
          white: '#F6F1E8',
          pure: '#FFFFFF',
          mist: '#EDE5D8',
          ice: '#E2D9CC',
          iceSoft: '#FBF9F5',
          royal: '#B99B73',
          royalHover: '#A58760',
          navy: '#201A14',
          navyDark: '#151311',
          navyCard: '#201C18',
          navyElevated: '#28231E',
          textSecondary: '#6E665D',
          textMuted: '#968E84',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'luxury-sm': '0 1px 3px 0 rgba(32, 26, 20, 0.04), 0 1px 2px -1px rgba(32, 26, 20, 0.04)',
        'luxury': '0 4px 20px -2px rgba(32, 26, 20, 0.05), 0 2px 6px -1px rgba(32, 26, 20, 0.02)',
        'luxury-lg': '0 12px 36px -4px rgba(32, 26, 20, 0.08), 0 4px 12px -2px rgba(32, 26, 20, 0.03)',
        'luxury-card': '0 2px 10px rgba(32, 26, 20, 0.04), 0 0 0 1px rgba(232, 225, 216, 0.8)',
        'luxury-card-dark': '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(51, 45, 38, 0.8)',
        'luxury-bronze': '0 4px 20px -2px rgba(185, 155, 115, 0.35)',

        // Backward compatibility
        'crystal': '0 4px 20px -2px rgba(32, 26, 20, 0.06), 0 1px 3px 0 rgba(32, 26, 20, 0.04)',
        'crystal-lg': '0 12px 36px -4px rgba(32, 26, 20, 0.08), 0 4px 12px 0 rgba(32, 26, 20, 0.04)',
        'crystal-glow': '0 0 25px -5px rgba(185, 155, 115, 0.25)',
        'crystal-dark': '0 4px 20px rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(255, 255, 255, 0.05)',
        'crystal-dark-lg': '0 16px 48px 0 rgba(0, 0, 0, 0.6), 0 4px 12px 0 rgba(0, 0, 0, 0.4)',
      },
      letterSpacing: {
        'luxury-tight': '-0.025em',
        'luxury-wide': '0.15em',
        'luxury-widest': '0.25em',
      }
    },
  },
  plugins: [],
}

