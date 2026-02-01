import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const getGitHash = () => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'dev';
	}
};

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__VERSION__: JSON.stringify(getGitHash())
	}
});
