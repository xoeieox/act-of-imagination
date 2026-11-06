import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

// Minimal flat config (aoi-repo-polish-v0 leg 2, sec 5.5): the Svelte parser
// + recommended baseline (not the opinionated rule set - no bikeshed),
// js.recommended, the I-6 server-module import restriction, and prettier
// compat. Formatting is prettier's job, not eslint's.
export default [
	{
		ignores: [
			'node_modules/**',
			'.svelte-kit/**',
			'.vercel/**',
			'build/**',
			'dist/**',
			'package-lock.json',
			'.pyuserbase/**'
		]
	},
	js.configs.recommended,
	...svelte.configs['flat/base'],
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// minimal set of real-error rules; let prettier own style
			'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
			// I-6: server-only modules must never reach client code
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['$lib/server/*', '$lib/server/**'],
							message:
								'src/lib/server/** is server-only (env lane table, key material). Import it only from +server.js / +page.server.js / +layout.server.js routes.'
						},
						{
							group: ['../server/*', '../server/**', '../../server/*', '../../server/**'],
							message:
								'src/lib/server/** is server-only (env lane table, key material). Use the $lib alias from server routes; never import server modules into client code.'
						}
					]
				}
			]
		}
	},
	{
		// server files (and test files, which run outside the bundle) are
		// exempt from the I-6 import restriction by definition
		files: ['src/routes/**/+*.js', 'src/lib/server/**', '**/*.test.js'],
		rules: {
			'no-restricted-imports': 'off'
		}
	},
	{
		files: ['scripts/**/*.js'],
		languageOptions: {
			globals: { ...globals.node }
		}
	},
	// keep formatting to prettier; disable stylistic svelte rules that fight it
	...svelte.configs['flat/prettier']
];
