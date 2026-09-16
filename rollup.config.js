import terser from '@rollup/plugin-terser';

const input = 'src/main.js';

export default {
	input,
	output: {
		file: 'dist/main.js',
		format: 'es',
		sourcemap: true,
	},
	plugins: [terser()],
};
