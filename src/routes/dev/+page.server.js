import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export function load() {
	// Block access in production builds
	if (!dev) {
		throw error(404, 'Not found');
	}

	return {};
}
