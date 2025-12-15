<script>
	import { goto } from '$app/navigation';
	import { signIn, signUp, isAuthenticated, hasLocalDataToMigrate } from '$lib/supabase/auth.js';
	import { isSupabaseConfigured } from '$lib/supabase/client.js';

	let mode = $state('signin'); // 'signin' or 'signup'
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state(null);
	let loading = $state(false);
	let message = $state(null);

	// Check if already authenticated
	$effect(() => {
		if ($isAuthenticated) {
			// Check if there's local data to migrate
			if (hasLocalDataToMigrate()) {
				goto('/migrate');
			} else {
				goto('/');
			}
		}
	});

	async function handleSubmit(e) {
		e.preventDefault();
		error = null;
		message = null;

		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		if (mode === 'signup' && password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}

		loading = true;

		try {
			if (mode === 'signup') {
				await signUp(email, password);
				message = 'Check your email to confirm your account';
			} else {
				await signIn(email, password);
				// Redirect happens via the $effect above
			}
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		mode = mode === 'signin' ? 'signup' : 'signin';
		error = null;
		message = null;
	}
</script>

<div class="min-h-full flex items-center justify-center p-6">
	<div class="w-full max-w-sm">
		<!-- Back link -->
		<a
			href="/"
			class="inline-flex items-center gap-2 text-silver-400 hover:text-silver-300 text-sm mb-8 transition-colors"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
			</svg>
			Back to exploration
		</a>

		{#if !isSupabaseConfigured()}
			<!-- Supabase not configured -->
			<div class="bg-depth-700 border border-silver-400/20 rounded-2xl p-6">
				<h2 class="font-serif text-xl text-silver-100 mb-4">Cloud sync unavailable</h2>
				<p class="text-silver-400 text-sm mb-4">
					Supabase is not configured. Your data is stored locally in this browser.
				</p>
				<p class="text-silver-400/60 text-xs">
					To enable cloud sync, add Supabase credentials to your environment variables.
				</p>
			</div>
		{:else}
			<!-- Auth form -->
			<div class="bg-depth-700 border border-silver-400/20 rounded-2xl p-6">
				<h2 class="font-serif text-xl text-silver-100 mb-2">
					{mode === 'signin' ? 'Welcome back' : 'Create account'}
				</h2>
				<p class="text-silver-400 text-sm mb-6">
					{mode === 'signin'
						? 'Sign in to sync your cards and assemblies across devices.'
						: 'Create an account to save your explorations to the cloud.'}
				</p>

				<form onsubmit={handleSubmit} class="space-y-4">
					<div>
						<label for="email" class="block text-silver-400 text-sm mb-1">Email</label>
						<input
							type="email"
							id="email"
							bind:value={email}
							class="w-full px-3 py-2 bg-depth-800 border border-silver-400/20 rounded-lg
								text-silver-100 placeholder-silver-400/40
								focus:border-silver-400/40 focus:outline-none transition-colors"
							placeholder="you@example.com"
							disabled={loading}
						/>
					</div>

					<div>
						<label for="password" class="block text-silver-400 text-sm mb-1">Password</label>
						<input
							type="password"
							id="password"
							bind:value={password}
							class="w-full px-3 py-2 bg-depth-800 border border-silver-400/20 rounded-lg
								text-silver-100 placeholder-silver-400/40
								focus:border-silver-400/40 focus:outline-none transition-colors"
							placeholder="••••••••"
							disabled={loading}
						/>
					</div>

					{#if mode === 'signup'}
						<div>
							<label for="confirmPassword" class="block text-silver-400 text-sm mb-1">Confirm password</label>
							<input
								type="password"
								id="confirmPassword"
								bind:value={confirmPassword}
								class="w-full px-3 py-2 bg-depth-800 border border-silver-400/20 rounded-lg
									text-silver-100 placeholder-silver-400/40
									focus:border-silver-400/40 focus:outline-none transition-colors"
								placeholder="••••••••"
								disabled={loading}
							/>
						</div>
					{/if}

					{#if error}
						<p class="text-red-400 text-sm">{error}</p>
					{/if}

					{#if message}
						<p class="text-emerald-400 text-sm">{message}</p>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="w-full px-4 py-2 rounded-lg font-medium transition-all duration-200
							bg-silver-400/10 text-silver-200 border border-silver-400/30
							hover:bg-silver-400/20 hover:border-silver-400/50
							disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if loading}
							<span class="flex items-center justify-center gap-2">
								<span class="w-4 h-4 border-2 border-silver-400/30 border-t-silver-400 rounded-full animate-spin"></span>
								{mode === 'signin' ? 'Signing in...' : 'Creating account...'}
							</span>
						{:else}
							{mode === 'signin' ? 'Sign in' : 'Create account'}
						{/if}
					</button>
				</form>

				<div class="mt-4 pt-4 border-t border-silver-400/10">
					<button
						onclick={toggleMode}
						class="text-silver-400 hover:text-silver-300 text-sm transition-colors"
					>
						{mode === 'signin'
							? "Don't have an account? Sign up"
							: 'Already have an account? Sign in'}
					</button>
				</div>
			</div>

			<!-- Local data notice -->
			{#if hasLocalDataToMigrate()}
				<div class="mt-4 p-4 bg-depth-700/50 border border-silver-400/10 rounded-xl">
					<p class="text-silver-400 text-sm">
						<span class="text-silver-200">You have local data.</span>
						Sign in to import your existing cards and conversations.
					</p>
				</div>
			{/if}
		{/if}
	</div>
</div>
