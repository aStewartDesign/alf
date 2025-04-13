import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter({
      config: {
        name: 'alf',
        main: '.svelte-kit/cloudflare/_worker.js',
        compatibility_date: '2025-01-01',
        assets: {
          binding: 'ASSETS',
          directory: '.svelte-kit/cloudflare',
        },
      },
    }),
  },
};

export default config;
