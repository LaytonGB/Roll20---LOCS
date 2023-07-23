/* eslint-disable */
// @ts-nocheck

import mockFunctions from './mocks/functions.test';
import mockValues from './mocks/values.test';

import { StateTrackerConfig, TokenStateApi } from '../src';

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
            const getArgs = ['graphic', 'mock_graphic_1'];
            const stateTrackerResult = stateTracker.getObj(...getArgs);
            const roll20Result = getObj(...getArgs);

            expect(stateTrackerResult).toBe(roll20Result);
            expect(stateTrackerResult.isCached).toBe(true);
            expect(typeof stateTrackerResult.get('top')).toBe('number');
            expect(
                stateTracker.debug.trackedPropertiesFor('mock_graphic_1')
            ).toContain('top');
        });
    });

    describe('getObj caching', () => {
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

    describe('object finding and filtering', () => {
        const objSearchParams = {
            type: 'graphic',
            top: mockValues.mockObjectConstants.mockGraphicTop,
        };

        const objSearchParamsKey = Object.entries(objSearchParams)
            .reduce(
                (str, [parameter, searchValue]) =>
                    str + `&${parameter}:${searchValue}`,
                ''
            )
            .slice(1);

        let stateTracker;
        beforeEach(() => {
            stateTracker = TokenStateApi.createStateTracker();
        });

        it('finds relevant items', () => {
            const foundObjects = stateTracker.findObjs({
                type: 'graphic',
                top: mockValues.mockObjectConstants.mockGraphicTop,
            });

            expect(foundObjects.length).toBe(0);
            expect(foundObjects[0]).toBe(
                mockValues.mockRequestResults.get('mock_graphic')
            );
        });

        it('caches previous searches', () => {
            expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(
                false
            );

            stateTracker.findObjs(objSearchParams);

            expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(
                true
            );
            expect(stateTracker.trackedEvents.has('add:graphic')).toBe(true);
            expect(stateTracker.trackedEvents.has('change:graphic:top')).toBe(
                true
            );
        });

        it('allows cache removal', () => {
            stateTracker.findObjs(objSearchParams);

            expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(
                true
            );

            stateTracker.trackedSearches.remove(objSearchParams);

            expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(
                false
            );
        });
    });

    describe('getAttrByName', () => {
        const getAttrCharacterId = 'mock_character';
        const getAttrArgs = [getAttrCharacterId, 'hp'];

        let stateTracker;
        beforeEach(() => {
            stateTracker = TokenStateApi.createStateTracker();
        });

        it('gets the correct attribute', () => {
            const stateTrackerResult = stateTracker.getAttrByName(
                ...getAttrArgs
            );
            const roll20Result = getAttrByName(...getAttrArgs);

            expect(stateTrackerResult).toBe(roll20Result);
        });

        it('caches each search', () => {
            const stateTrackerResult = stateTracker.getAttrByName(
                ...getAttrArgs
            );

            expect(stateTracker.trackedEvents.has('destroy:character')).toBe(
                true
            );
            expect(
                stateTracker.trackedPropertiesFor(getAttrCharacterId)
            ).toContain('hp');
        });
    });
});
