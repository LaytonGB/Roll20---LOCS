/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { MockObjectName } from './mocks/values';

import mockValues from './mocks/values';

import { TokenStateApi } from '../src';

describe('state constructor', () => {
    it('can be created with no input', () => {
        const stateTracker = TokenStateApi.createStateTracker();

        expect(stateTracker).toBeDefined();
    });

    it('is empty on creation', () => {
        const stateTracker = TokenStateApi.createStateTracker();

        expect(stateTracker.cache.size).toBe(0);
    });
});

describe.only('object fetching', () => {
    const getArgsType = 'graphic';
    const getArgsId = MockObjectName.MOCK_PLAYER;
    const getArgs = [getArgsType, getArgsId];

    let stateTracker;
    beforeEach(() => {
        stateTracker = TokenStateApi.createStateTracker();
    });

    it('returns values just like roll20', () => {
        const fetchedCharacter = stateTracker.getObj(...getArgs);

        expect(fetchedCharacter).toBeDefined();
        expect(typeof fetchedCharacter.id).toBe('string');
    });

    it('adds a stateTracker property to objects', () => {
        const stateTrackerResult = stateTracker.getObj(...getArgs);

        expect(stateTrackerResult.stateTracker).toBeDefined();
    });
});

describe('object and property caching', () => {
    const getArgsType = 'graphic';
    const getArgsId = MockObjectName.MOCK_GRAPHIC;
    const getArgs = [getArgsType, getArgsId];

    let stateTracker;
    beforeEach(() => {
        stateTracker = TokenStateApi.createStateTracker();
    });

    it('caches fetched ids', () => {
        stateTracker.getObj(...getArgs);

        expect(stateTracker.cache.size).toBe(1);
        expect(stateTracker.cache.has(getArgsId)).toBe(true);
    });

    it('returns objects that replace usual methods to track fetched properties', () => {
        const stateTrackerResult = stateTracker.getObj(...getArgs);
        typeof stateTrackerResult.get('top');

        expect(stateTrackerResult.stateTracker.trackedProps.has('top')).toBe(
            true
        );
        expect(stateTracker.cache.get(getArgsId).has('top')).toBe(true);
    });

    it('allows users to get properties without caching', () => {
        const stateTrackerResult = stateTracker.getObj(...getArgs);
        stateTrackerResult.get_nocache('top');

        expect(stateTrackerResult.stateTracker.trackedProps.has('top')).toBe(
            false
        );
    });

    it('allows users to remove object caching', () => {
        stateTracker.getObj(...getArgs);
        stateTracker.cache.remove(getArgsId);

        expect(stateTracker.cache.has(getArgsId)).toBe(false);
    });

    it('allows users to remove property caching using the object', () => {
        const stateTrackerResult = stateTracker.getObj(...getArgs);
        stateTrackerResult.get('top');
        stateTrackerResult.stateTracker.stopTrackingProp('top');

        expect(stateTrackerResult.stateTracker.trackedProps.has('top')).toBe(
            false
        );
        expect(stateTracker.cache.get(getArgsId).has('top')).toBe(false);
    });

    it('allows users to remove property caching manually', () => {
        const stateTrackerResult = stateTracker.getObj(...getArgs);
        stateTrackerResult.get('top');
        stateTracker.cache.get(getArgsId).remove('top');

        expect(stateTrackerResult.stateTracker.trackedProps.has('top')).toBe(
            false
        );
        expect(stateTracker.cache.get(getArgsId).has('top')).toBe(false);
    });

    it('allows users to stop an object from being cached', () => {
        stateTracker.blackLists.ids.add(getArgsId);
        stateTracker.getObj(...getArgs);

        expect(stateTracker.cache.has(getArgsId)).toBe(false);
    });

    it('allows users to stop a property from being cached', () => {
        const stateTrackerResult = stateTracker.getObj(...getArgs);
        stateTracker.blackLists.properties.add('top');
        stateTrackerResult.get('top');

        expect(stateTrackerResult.stateTracker.trackedProps.has('top')).toBe(
            false
        );
    });

    it('allows users to stop a specific objects property from being cached', () => {
        const stateTrackerResult = stateTracker.getObj(...getArgs);
        stateTracker.blackLists.details.set(getArgsId, new Set('top'));
        stateTrackerResult.get('top');

        expect(stateTrackerResult.stateTracker.trackedProps.has('top')).toBe(
            false
        );
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
                str + `&${parameter}=${searchValue}`,
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

        expect(foundObjects.length).toBe(1);
        expect(foundObjects[0]).toBe(
            mockValues.mockRequestResults.get(MockObjectName.MOCK_GRAPHIC)
        );
    });

    it('caches previous searches', () => {
        expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(
            false
        );

        const foundObjs = stateTracker.findObjs(objSearchParams);

        expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(true);
        expect(stateTracker.trackedSearches.get(objSearchParamsKey).size).toBe(
            1
        );
        expect(foundObjs).toStrictEqual(
            stateTracker.trackedSearches.get(objSearchParamsKey)
        );
    });

    it('tracks updates to maintain find results', () => {
        expect(stateTracker.trackedEvents.has('add:graphic')).toBe(false);
        expect(stateTracker.trackedEvents.has('change:graphic:top')).toBe(
            false
        );
        expect(stateTracker.trackedEvents.has('destroy:graphic')).toBe(false);

        stateTracker.findObjs(objSearchParams);

        expect(stateTracker.trackedEvents.has('add:graphic')).toBe(true);
        expect(stateTracker.trackedEvents.has('change:graphic:top')).toBe(true);
        // TODO add test for events
        expect(stateTracker.trackedEvents.has('destroy:graphic')).toBe(true);
        expect(stateTracker.trackedSearches.get(objSearchParamsKey).size).toBe(
            1
        );

        const createdGraphic = createObj('graphic');

        expect(stateTracker.trackedSearches.get(objSearchParamsKey).size).toBe(
            2
        );
        expect(
            stateTracker.trackedSearches.get(objSearchParamsKey)
        ).toContainEqual(createdGraphic);
    });

    it('allows cache removal', () => {
        stateTracker.findObjs(objSearchParams);
        stateTracker.trackedSearches.remove(objSearchParams);

        expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(
            false
        );
    });
});

describe('getAttrByName', () => {
    const getAttrCharacterId = MockObjectName.MOCK_CHARACTER;
    const getAttrArgs = [getAttrCharacterId, 'hp'];

    let stateTracker;
    beforeEach(() => {
        stateTracker = TokenStateApi.createStateTracker();
    });

    // TODO review
    it('caches each search', () => {
        stateTracker.getAttrByName(...getAttrArgs);

        expect(stateTracker.trackedEvents.has('destroy:character')).toBe(true);
        expect(stateTracker.trackedAttributesFor(getAttrCharacterId)).toContain(
            'hp'
        );
    });
});
