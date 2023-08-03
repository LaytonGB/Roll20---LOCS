/* eslint-disable @typescript-eslint/ban-ts-comment */

import { MockObjectName } from './mocks/values';
import mockValues from './mocks/values';
import mockFunctions from './mocks/functions';

import {
  IStateTracker,
  IStateTrackerObject,
  Roll20EventLabel,
  TokenStateApi,
} from '../src';
import { MockRoll20Object } from './utils/roll20';

// @ts-ignore not assignable error because of roll20 types
global.getObj = () => {
  return;
};
const getObjMock = jest.fn<Roll20Object | undefined, [ObjectType, string]>(
  mockFunctions.getObj
);
const getObjSpy = jest.spyOn(global, 'getObj').mockImplementation(getObjMock);

// @ts-ignore
global.findObjs = () => {
  return;
};
const findObjsMock = jest.fn<Roll20Object[], [{ [property: string]: any }]>(
  mockFunctions.findObjs
);
const findObjsSpy = jest
  .spyOn(global, 'findObjs')
  .mockImplementation(findObjsMock);

const { triggerEvent, on } = mockFunctions.getOnFunctions();
// @ts-ignore
global.on = () => {
  return;
};
const onMock = jest.fn<void, [Roll20EventLabel, (obj: Roll20Object) => void]>(
  on
);
// @ts-ignore On overload causing bad-selection error
/* const onSpy =  */ jest.spyOn(global, 'on').mockImplementation(onMock);

describe('state constructor', () => {
  it('can be created with no input', () => {
    const stateTracker = TokenStateApi.createStateTracker();

    expect(stateTracker).toBeDefined();
  });

  it('is empty on creation', () => {
    const stateTracker = TokenStateApi.createStateTracker();

    expect(stateTracker.cache.size).toBe(0);
  });

  it.todo('registers event listeners');
});

describe('object fetching', () => {
  const getArgsType = 'player';
  const getArgsId = MockObjectName.MOCK_PLAYER;
  const getArgs: [ObjectType, string] = [getArgsType, getArgsId];

  let stateTracker: IStateTracker;
  beforeEach(() => {
    stateTracker = TokenStateApi.createStateTracker();
  });

  it('returns values just like roll20', () => {
    const fetchedCharacter = stateTracker.getObj(...getArgs);

    expect(fetchedCharacter).toBeDefined();
    expect(typeof fetchedCharacter?.id).toBe('string');
  });

  it('adds a stateTracker property to objects', () => {
    const stateTrackerResult = stateTracker.getObj(...getArgs);

    expect(stateTrackerResult?.stateTracker).toBeDefined();
  });
});

describe('object modifying', () => {
  it('fetched objects can have their properties set', () => {
    const stateTracker = TokenStateApi.createStateTracker();

    const getArgsType = 'graphic';
    const getArgsId = MockObjectName.MOCK_GRAPHIC;
    const getArgs: [ObjectType, string] = [getArgsType, getArgsId];

    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTrackerResult?.set('top', 15);

    expect(stateTrackerResult?.get('top')).toBe(15);
    expect(getObj(...getArgs)?.get('top')).toBe(15);
  });

  afterAll(() => {
    const stateTracker = TokenStateApi.createStateTracker();

    const getArgsType = 'graphic';
    const getArgsId = MockObjectName.MOCK_GRAPHIC;
    const getArgs: [ObjectType, string] = [getArgsType, getArgsId];

    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTrackerResult?.set(
      'top',
      mockValues.mockObjectConstants.mockGraphicTop
    );
  });
});

describe('object and property caching', () => {
  const getArgsType = 'graphic';
  const getArgsId = MockObjectName.MOCK_GRAPHIC;
  const getArgs: [ObjectType, string] = [getArgsType, getArgsId];

  let stateTracker: IStateTracker;
  beforeEach(() => {
    stateTracker = TokenStateApi.createStateTracker();
  });

  it('caches fetched ids', () => {
    stateTracker.getObj(...getArgs);

    expect(stateTracker.cache.size).toBe(1);
    expect(stateTracker.cache.has(getArgsId)).toBe(true);
  });

  it('caches fetched object properties', () => {
    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTrackerResult?.get('top');

    expect(stateTrackerResult?.stateTracker.trackedProps.has('top')).toBe(true);
    expect(stateTracker.cache.get(getArgsId)?.trackedProps?.has('top')).toBe(
      true
    );

    const getObjCallCount = getObjSpy.mock.calls.length;
    stateTrackerResult?.get('top');

    expect(getObjSpy).toHaveBeenCalledTimes(getObjCallCount);
  });

  it('gets properties that do not yet have caching', () => {
    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTrackerResult?.getWithoutCaching('top');

    expect(stateTrackerResult?.stateTracker.trackedProps.has('top')).toBe(
      false
    );
  });

  it('can remove object caching', () => {
    stateTracker.getObj(...getArgs);
    stateTracker.cache.delete(getArgsId);

    expect(stateTracker.cache.has(getArgsId)).toBe(false);
  });

  it('can remove property caching using the related object', () => {
    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTrackerResult?.get('top');
    stateTrackerResult?.stateTracker.trackedProps.delete('top');

    expect(stateTrackerResult?.stateTracker.trackedProps.has('top')).toBe(
      false
    );
    expect(stateTracker.cache.get(getArgsId)?.trackedProps.has('top')).toBe(
      false
    );
  });

  it('can remove property caching using the stateTracker object', () => {
    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTrackerResult?.get('top');
    stateTracker.cache.get(getArgsId)?.trackedProps.delete('top');

    expect(stateTrackerResult?.stateTracker.trackedProps.has('top')).toBe(
      false
    );
    expect(stateTracker.cache.get(getArgsId)?.trackedProps.has('top')).toBe(
      false
    );
  });

  it('can stop an object from being cached', () => {
    stateTracker.blacklist.ids.add(getArgsId);
    const stateTrackerResult = stateTracker.getObj(...getArgs);

    expect(stateTrackerResult).toBeDefined();
    expect(stateTracker.cache.has(getArgsId)).toBe(false);
  });

  it('can stop a property from being cached', () => {
    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTracker.blacklist.properties.add('top');
    stateTrackerResult?.get('top');

    expect(stateTrackerResult).toBeDefined();
    expect(stateTrackerResult?.stateTracker.trackedProps.has('top')).toBe(
      false
    );
  });

  it('can stop a specific objects property from being cached', () => {
    stateTracker.blacklist.details.set(getArgsId, new Set(['top']));
    const stateTrackerResult = stateTracker.getObj(...getArgs);
    stateTrackerResult?.get('top');

    expect(stateTrackerResult).toBeDefined();
    expect(stateTrackerResult?.stateTracker.trackedProps.has('top')).toBe(
      false
    );
  });

  describe('events', () => {
    beforeEach(() => {
      stateTracker = TokenStateApi.createStateTracker();
    });

    it('updates cached values on change', () => {
      const newTopValue = 15;

      stateTracker.getObj(...getArgs);
      getObj(...getArgs)?.set('top', newTopValue);

      expect(stateTracker.cache.get(getArgsId)?.trackedProps.get('top')).toBe(
        newTopValue
      );
    });

    it.todo('removes cache entries on destroy');

    afterAll(() => {
      stateTracker = TokenStateApi.createStateTracker();
      const stateTrackerResult = stateTracker.getObj(...getArgs);
      stateTrackerResult?.set(
        'top',
        mockValues.mockObjectConstants.mockGraphicTop
      );
    });
  });
});

describe('object finding and filtering', () => {
  function paramsIntoKey(params: { [param: string]: any }) {
    return Object.entries(params)
      .reduce(
        (str, [parameter, searchValue]) => str + `&${parameter}=${searchValue}`,
        ''
      )
      .slice(1);
  }

  const objSearchResultIds = [
    MockObjectName.CREATED_GRAPHIC,
    MockObjectName.MOCK_GRAPHIC,
  ];

  const objSearchType = 'graphic';
  const objSearchParams = {
    _type: objSearchType,
    top: mockValues.mockObjectConstants.mockGraphicTop,
  };
  const objSearchParamsKey = paramsIntoKey(objSearchParams);

  const noResultsSearchParams = {
    _type: 'page',
    top: mockValues.mockObjectConstants.mockGraphicTop,
  };
  const noResultsSearchParamsKey = paramsIntoKey(noResultsSearchParams);

  let stateTracker: IStateTracker;
  beforeEach(() => {
    stateTracker = TokenStateApi.createStateTracker();
  });

  it('finds relevant items', () => {
    const foundObjects = stateTracker.findObjs(objSearchParams);

    expect(foundObjects.length).toBe(2);

    const foundObjectIds = foundObjects.map((obj) => obj.id);
    expect(foundObjectIds).toMatchObject(objSearchResultIds);
  });

  it('caches previous searches if type is given', () => {
    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(false);

    stateTracker.findObjs(objSearchParams);

    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(true);
    expect(stateTracker.trackedSearches.get(objSearchParamsKey)?.length).toBe(
      2
    );
  });

  it.todo('still returns items if type is excluded');

  it('caches even when no results are found', () => {
    expect(stateTracker.trackedSearches.has(noResultsSearchParamsKey)).toBe(
      false
    );

    stateTracker.findObjs(noResultsSearchParams);

    expect(stateTracker.trackedSearches.has(noResultsSearchParamsKey)).toBe(
      true
    );
    expect(
      stateTracker.trackedSearches.get(noResultsSearchParamsKey)?.length
    ).toBe(0);
  });

  // TODO add caching for searches with no type
  it('caches nothing if type is excluded', () => {
    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(false);

    stateTracker.findObjs({ top: objSearchParams.top });

    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(false);
  });

  describe('tracks updates to maintain find results', () => {
    const eventGraphicId = 'on_graphic';

    let findObjsResults: IStateTrackerObject[];
    beforeEach(() => {
      stateTracker = TokenStateApi.createStateTracker();
      findObjsResults = stateTracker.findObjs(objSearchParams);
    });

    it('adds new results to cache when matching object created', () => {
      const objsFoundCount = findObjsResults.length;
      const findObjsCallsAtTestStart = findObjsSpy.mock.calls.length;

      triggerEvent(
        'add:graphic',
        new MockRoll20Object('graphic', eventGraphicId, {
          top: mockValues.mockObjectConstants.mockGraphicTop,
        })
      );

      const newSearchCacheIds = stateTracker.trackedSearches
        .get(objSearchParamsKey)
        ?.map((x) => x[1]);

      expect(newSearchCacheIds?.length).toBe(objsFoundCount + 1);
      expect(newSearchCacheIds).toContain(eventGraphicId);
      expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallsAtTestStart);
    });

    it('removes entries from cache when matching object destroyed', () => {
      const objsFoundCount = findObjsResults.length;
      const findObjsCallsAtTestStart = findObjsSpy.mock.calls.length;
      const idToBeRemoved = findObjsResults[0].id;

      triggerEvent(
        'destroy:graphic',
        new MockRoll20Object('graphic', idToBeRemoved, {
          top: mockValues.mockObjectConstants.mockGraphicTop,
        })
      );

      const newSearchCacheIds = stateTracker.trackedSearches
        .get(objSearchParamsKey)
        ?.map((x) => x[1]);

      expect(newSearchCacheIds?.length).toBe(objsFoundCount - 1);
      expect(newSearchCacheIds).not.toContain(idToBeRemoved);
      expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallsAtTestStart);
    });
  });

  it('allows cache removal', () => {
    stateTracker.findObjs(objSearchParams);
    const trackedEventsForSearch =
      stateTracker.trackedEvents.get(objSearchParamsKey);

    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(true);
    expect(trackedEventsForSearch?.has(`add:${objSearchType}`)).toBe(true);
    expect(trackedEventsForSearch?.has(`change:${objSearchType}`)).toBe(true);
    expect(trackedEventsForSearch?.has(`destroy:${objSearchType}`)).toBe(true);

    stateTracker.removeTrackedSearch(objSearchParams);

    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(false);
  });
});

describe.skip('getAttrByName and getAttrObjByName', () => {
  const getAttrCharacterId = MockObjectName.MOCK_CHARACTER;
  const getAttrArgs: [string, string] = [getAttrCharacterId, 'hp'];

  let stateTracker: IStateTracker;
  beforeEach(() => {
    stateTracker = TokenStateApi.createStateTracker();
  });

  // TODO review
  it('caches each search', () => {
    stateTracker.getAttrObjByName(...getAttrArgs);

    expect(stateTracker.trackedEvents.has('destroy:character')).toBe(true);
    expect(
      stateTracker.trackedAttributesForCharacter.get(getAttrCharacterId)
    ).toContain('hp');
  });
});
