import { writable } from 'svelte/store';

/**
 * Navigation store for coordinating views between layout and pages
 */
function createNavigationStore() {
	const { subscribe, set, update } = writable({
		currentView: null, // 'cards', 'assemblies', or null for main view
		menuOpen: false
	});

	return {
		subscribe,

		openMenu() {
			update((state) => ({ ...state, menuOpen: true }));
		},

		closeMenu() {
			update((state) => ({ ...state, menuOpen: false }));
		},

		showCards() {
			update((state) => ({ ...state, currentView: 'cards', menuOpen: false }));
		},

		showAssemblies() {
			update((state) => ({ ...state, currentView: 'assemblies', menuOpen: false }));
		},

		showHome() {
			update((state) => ({ ...state, currentView: null, menuOpen: false }));
		},

		clearView() {
			update((state) => ({ ...state, currentView: null }));
		},

		reset() {
			set({ currentView: null, menuOpen: false });
		}
	};
}

export const navigation = createNavigationStore();
