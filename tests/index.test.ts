/* eslint-disable */
// @ts-nocheck

import mockFunctions from './mocks/functions.test';
import mockValues from './mocks/values.test';

import { StateTrackerConfig, TokenStateApi } from '../src';

mock();

describe('state constructor', () => {
    it('can be created with no input', () => {
        const stateTracker = TokenStateApi.createStateTracker();

        expect(stateTracker).toBeDefined();
    });

    it('is empty on creation', () => {
        const stateTracker = TokenStateApi.createStateTracker();

        expect(stateTracker.debug.cachedIds.length).toBe(0);
    });

    it('returns values just like roll20', () => {
        const stateTracker = TokenStateApi.createStateTracker();

        expect(stateTracker.getObj('mock_id_1')).toBeDefined();
    });

    it('caches fetched ids', () => {
        const stateTracker = TokenStateApi.createStateTracker();

        stateTracker.getObj('mock_id_1');

        expect(stateTracker.debug.cachedIds.length).toBe(1);
        expect(stateTracker.debug.cachedIds[0]).toBe('mock_id_1');
    });

    describe('object fetching', () => {
        let stateTracker;
        beforeEach(() => {
            stateTracker = TokenStateApi.createStateTracker();
        });

        it('returns objects that replace usual methods to track fetched properties', () => {
            const obj1 = stateTracker.getObj('mock_graphic_1');

            expect(obj1.isCached).toBe(true);
            expect(typeof obj1.get('top')).toBe('number');
            expect(
                stateTracker.debug.trackedPropertiesFor('mock_graphic_1')
            ).toContain('top');
        });
    });

    describe('object and property caching', () => {
        let stateTracker;
        beforeEach(() => {
            stateTracker = TokenStateApi.createStateTracker();
        });

        it('allows users to remove caching', () => {
            const obj1 = stateTracker.getObj('mock_graphic_1');

            expect(obj1.isCached).toBe(true);

            obj1.cache.remove();

            expect(obj1.isCached).toBe(false);
        });

        it('allows users to get properties without caching', () => {
            const obj1 = stateTracker.getObj('mock_graphic_1');

            expect(obj1.isCached).toBe(true);

            obj1.get_nocache('top');

            expect(stateTracker);
        });

        it('allows users to remove property caching', () => {
            const obj1 = stateTracker.getObj('mock_graphic_1');

            expect(obj1.cache.has('top')).toBe(true);

            obj1.cache.remove('top');

            expect(obj1.cache.has('top')).toBe(false);
        });
    });
});
