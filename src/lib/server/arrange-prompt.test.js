/**
 * Arrange prompt module unit tests (aoi-arrangement-play-v0).
 *
 * Locks the design :335-348 prompt shape: slot positions, essences, depth
 * indicators, the gravitational-pull instruction, and the narrator contract
 * lines the I-7 replay fixture asserts (arrange-narrative-prompt.yaml).
 */
import { describe, it, expect } from 'vitest';
import {
	ARRANGE_SYSTEM_PROMPT,
	depthIndicator,
	renderSlotLine,
	normalizeSlots,
	buildArrangeMessages
} from './arrange-prompt.js';

const door = {
	id: 'c1',
	name: 'The Locked Door',
	essence: 'Readiness not yet claimed',
	type: 'object',
	depth: 0.9
};
const hall = {
	id: 'c2',
	name: 'Hallway of Unfinished Rooms',
	essence: 'Everything left mid-construction',
	type: 'place',
	depth: 0.2
};

describe('depthIndicator', () => {
	it('classifies heavy, settling, and faint depths', () => {
		expect(depthIndicator(0.9)).toMatch(/depth 0\.9 - heavy presence/);
		expect(depthIndicator(0.5)).toMatch(/depth 0\.5 - settling weight/);
		expect(depthIndicator(0.1)).toMatch(/depth 0\.1 - faint presence/);
	});

	it('omits the indicator for missing or non-numeric depth', () => {
		expect(depthIndicator(undefined)).toBeNull();
		expect(depthIndicator(null)).toBeNull();
		expect(depthIndicator('deep')).toBeNull();
	});
});

describe('renderSlotLine', () => {
	it('renders a placed card with type and depth', () => {
		expect(renderSlotLine(0, door)).toBe(
			'Slot 1: "The Locked Door" - Readiness not yet claimed (object, depth 0.9 - heavy presence)'
		);
	});

	it('renders an empty slot', () => {
		expect(renderSlotLine(2, null)).toBe('Slot 3: empty');
	});
});

describe('normalizeSlots', () => {
	it('pads a plain cards array to 3 slots, left to right', () => {
		expect(normalizeSlots([door, hall])).toEqual([door, hall, null]);
	});

	it('keeps an explicit slots array including interior nulls', () => {
		expect(normalizeSlots([null, hall, null])).toEqual([null, hall, null]);
	});

	it('truncates to the 3 design slots and survives junk', () => {
		expect(normalizeSlots([door, hall, door, door]).length).toBe(3);
		expect(normalizeSlots('nope')).toEqual([null, null, null]);
	});
});

describe('buildArrangeMessages', () => {
	const messages = buildArrangeMessages([door, null, hall], 'CTX PROMPT TEXT');
	const user = messages[1].content;

	it('keeps the fixture-locked narrator system prompt', () => {
		expect(messages[0].role).toBe('system');
		expect(messages[0].content).toBe(ARRANGE_SYSTEM_PROMPT);
		expect(messages[0].content).toContain('You are a narrator witnessing an interaction');
		expect(messages[0].content).toContain('Do NOT interpret or explain');
		expect(messages[0].content).toContain('present tense');
	});

	it('renders positions/slots with essences and depth indicators (design :335-348)', () => {
		expect(user).toContain('The user has arranged the following cards:');
		expect(user).toContain('Slot 1: "The Locked Door" - Readiness not yet claimed');
		expect(user).toContain('heavy presence');
		expect(user).toContain('Slot 2: empty');
		expect(user).toContain('Slot 3: "Hallway of Unfinished Rooms"');
		expect(user).toContain('faint presence');
	});

	it('carries the selected context and the gravitational-pull instruction', () => {
		expect(user).toContain('Context: CTX PROMPT TEXT');
		expect(user).toContain('Heavier cards should have more gravitational pull in the narrative');
		expect(user).toContain('2-3 paragraphs');
		expect(user).toContain('invites contemplation');
	});

	it('accepts the legacy plain-cards shape', () => {
		const legacy = buildArrangeMessages([door, hall], 'CTX');
		expect(legacy[1].content).toContain('Slot 1: "The Locked Door"');
		expect(legacy[1].content).toContain('Slot 2: "Hallway of Unfinished Rooms"');
		expect(legacy[1].content).toContain('Slot 3: empty');
	});
});
