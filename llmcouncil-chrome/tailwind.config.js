/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Brutalist color palette (NO PURPLE)
                'signal-orange': '#FF6B00',
                'deep-gray': '#1A1A1A',
                'acid-green': '#39FF14',
            },
            borderRadius: {
                '0': '0px',
                '2': '2px', // Maximum for brutalist theme
            },
        },
    },
    plugins: [],
}
