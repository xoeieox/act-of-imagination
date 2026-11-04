/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Moonlight on water palette
				depth: {
					900: '#0a0a0f',  // Deepest dark
					800: '#0f0f1a',  // Deep background
					700: '#151525',  // Card background
					600: '#1a1a2e',  // Elevated surfaces
				},
				silver: {
					100: '#f0f0f5',  // Bright moonlight
					200: '#c8c8d4',  // Soft silver
					300: '#9898a8',  // Muted silver
					400: '#68687a',  // Dim silver
				},
				water: {
					surface: 'rgba(200, 200, 212, 0.1)',  // Water surface shimmer
					murky: 'rgba(15, 15, 26, 0.8)',       // Murky depths
				}
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				serif: ['Crimson Pro', 'Georgia', 'serif'],
			},
			animation: {
				'float': 'float 6s ease-in-out infinite',
				'shimmer': 'shimmer 3s ease-in-out infinite',
				'rise': 'rise 2s ease-out forwards',
			},
			keyframes: {
				float: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-10px)' },
				},
				shimmer: {
					'0%, 100%': { opacity: '0.3' },
					'50%': { opacity: '0.6' },
				},
				rise: {
					'0%': { transform: 'translateY(20px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' },
				},
			},
		},
	},
	plugins: [],
};
