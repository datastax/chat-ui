// svelte.config.js
import vercel from '@sveltejs/adapter-vercel';
import preprocess from 'svelte-preprocess';

const config = {
  // Your original config here
  kit: {
    adapter: vercel(),
    // rest of your config
  },
  preprocess: preprocess(),
};

export default config;
