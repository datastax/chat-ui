import { defineConfig, type PluginOption } from "vite";
import { sveltekit } from '@sveltejs/kit/vite';
import Icons from "unplugin-icons/vite";
import { promises } from "fs";
import path from "path";

// used to load fonts server side for thumbnail generation
function loadTTFAsArrayBuffer(): PluginOption {
	return {
		name: "load-ttf-as-array-buffer",
		async transform(_src, id) {
			if (id.endsWith(".ttf")) {
				return `export default new Uint8Array([
			${new Uint8Array(await promises.readFile(id))}
		  ]).buffer`;
			}
		},
	};
}

export default defineConfig({
	plugins: [
		sveltekit(),
		Icons({
			compiler: "svelte",
		}),
		loadTTFAsArrayBuffer(),
	],
	optimizeDeps: {
		include: ["browser-image-resizer", "uuid", "@datastax/astra-db-ts"],
	},
    ssr: {
      external: ['@datastax/astra-db-ts']
    },
    build: {
      rollupOptions: {
        external: ['@datastax/astra-db-ts']
      }
    },
    resolve: {
      alias: {
        '@datastax/astra-db-ts': path.resolve(__dirname, '/home/tato/Desktop/astra-db-ts/dist')
      }
    },
});
