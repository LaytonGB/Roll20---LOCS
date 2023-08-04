/* eslint-disable @typescript-eslint/ban-ts-comment */

import { MockObjectName } from './mocks/values';
import mockValues from './mocks/values';
import mockFunctions from './mocks/functions';

import { IStateTracker, Roll20EventLabel, TokenStateApi } from '../src';
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
const onSpy = jest.spyOn(global, 'on').mockImplementation(onMock);

describe('state constructor', () => {
  it('can be created with no input', () => {
    const stateTracker = TokenStateApi.createStateTracker();

    expect(stateTracker).toBeDefined();
  });

  it('is empty on creation', () => {
    const stateTracker = TokenStateApi.createStateTracker();

    expect(stateTracker.cache.size).toBe(0);
  });

  it('registers event listeners', () => {
    const startingOnSpyCallCount = onSpy.mock.calls.length;

    TokenStateApi.createStateTracker();

    expect(onSpy).toHaveBeenCalledTimes(startingOnSpyCallCount + 9); // numberOfConfiguredAttributes * numberOfRelevantEvents
  });
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
});

describe('object and property caching', () => {
  const getArgsType = 'graphic';
  const getArgsId = MockObjectName.MOCK_GRAPHIC;
  const getArgs: [ObjectType, string] = [getArgsType, getArgsId];

  let stateTracker: IStateTracker;
  beforeEach(() => {
    stateTracker = TokenStateApi.createStateTracker();
  });

  it('caches fetched objects', () => {
    stateTracker.getObj(...getArgs);

    expect(stateTracker.cache.size).toBe(1);
    expect(stateTracker.cache.has(getArgsId)).toBe(true);

    const getObjCallCount = getObjSpy.mock.calls.length;
    stateTracker.getObj(...getArgs);

    expect(getObjSpy).toBeCalledTimes(getObjCallCount);
  });

  it('can remove object caching', () => {
    stateTracker.getObj(...getArgs);
    stateTracker.cache.delete(getArgsId);

    expect(stateTracker.cache.has(getArgsId)).toBe(false);
  });

  it('can stop an object from being cached', () => {
    stateTracker.blacklist.add(getArgsId);
    const stateTrackerResult = stateTracker.getObj(...getArgs);

    expect(stateTrackerResult).toBeDefined();
    expect(stateTracker.cache.has(getArgsId)).toBe(false);
  });

  describe('events', () => {
    beforeEach(() => {
      stateTracker = TokenStateApi.createStateTracker();
    });

    it('cached objects update when fetched objects are changed', () => {
      const newTopValue = 15;

      const cachedObject = stateTracker.getObj(...getArgs);
      const fetchedObject = getObj(...getArgs);
      fetchedObject?.set('top', newTopValue);

      expect(cachedObject?.get('top')).toBe(newTopValue);
    });

    it('removes cache entries on destroy', () => {
      const cachedObject = stateTracker.getObj(...getArgs);

      expect(
        stateTracker.trackedEvents.get(getArgsId)?.get(`destroy:${getArgsType}`)
      ).toBeDefined();

      triggerEvent('destroy:graphic', cachedObject as Roll20Object);

      expect(stateTracker.cache.get(getArgsId)).toBeUndefined();
      expect(stateTracker.trackedEvents.get(getArgsId)).toBeUndefined();
    });

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

    const cachedSearchObjects = stateTracker.findObjs(objSearchParams);
    const cachedObjectIds = cachedSearchObjects.map((obj) => obj.id);

    expect(cachedObjectIds).toMatchObject(objSearchResultIds);
  });

  it('caches previous searches', () => {
    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(false);

    stateTracker.findObjs(objSearchParams);

    expect(stateTracker.trackedSearches.has(objSearchParamsKey)).toBe(true);
    expect(stateTracker.trackedSearches.get(objSearchParamsKey)?.length).toBe(
      2
    );
  });

  it('still returns items if type is excluded', () => {
    const objSearchParamsWithoutType = {
      top: mockValues.mockObjectConstants.mockGraphicTop,
    };
    const objSearchParamsWithoutTypeKey = paramsIntoKey(
      objSearchParamsWithoutType
    );

    expect(
      stateTracker.trackedSearches.has(objSearchParamsWithoutTypeKey)
    ).toBe(false);

    expect(
      stateTracker.findObjs(objSearchParamsWithoutType).length
    ).toBeTruthy();

    expect(
      stateTracker.trackedSearches.has(objSearchParamsWithoutTypeKey)
    ).toBe(true);
  });

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

  describe('tracks updates to maintain find results', () => {
    const eventGraphicId = 'on_graphic';

    let findObjsResults: Roll20Object[];
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

// TODO condense tests using loops
describe('getAttrByName and getAttrObjByName', () => {
  function paramsIntoKey([character_id, attribute_name]: [string, string]) {
    return `_type=attribute&_characterid=${character_id}&name=${attribute_name}`;
  }

  const getAttrCharacterId = MockObjectName.MOCK_CHARACTER;
  const getAttrArgs: [string, string] = [getAttrCharacterId, 'hp'];

  let stateTracker: IStateTracker;
  beforeEach(() => {
    stateTracker = TokenStateApi.createStateTracker();
  });

  it('getAttrObjByName caches each search', () => {
    const cacheKey = paramsIntoKey(getAttrArgs);
    stateTracker.getAttrObjByName(...getAttrArgs);

    expect(
      stateTracker.trackedSearches.get(cacheKey)?.map(([, id]) => id)
    ).toContain(MockObjectName.MOCK_ATTRIBUTE);
  });

  it('getAttrObjByName uses cached values after first search', () => {
    stateTracker.getAttrObjByName(...getAttrArgs);

    const findObjsSpyCallCount = findObjsSpy.mock.calls.length;

    stateTracker.getAttrObjByName(...getAttrArgs);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsSpyCallCount);
  });

  it('getAttrObjByName adds events for each search', () => {
    const cacheKey = paramsIntoKey(getAttrArgs);

    expect(stateTracker.trackedEvents.has(cacheKey)).toBe(false);

    stateTracker.getAttrObjByName(...getAttrArgs);

    const trackedEvents = stateTracker.trackedEvents.get(cacheKey);
    expect(trackedEvents).toBeDefined();
    expect(trackedEvents?.has('add:attribute')).toBe(true);
    expect(trackedEvents?.has('change:attribute')).toBe(true);
    expect(trackedEvents?.has('destroy:attribute')).toBe(true); // fires if related character destroyed
  });

  it('getAttrByName caches each search', () => {
    const cacheKey = paramsIntoKey(getAttrArgs);
    stateTracker.getAttrByName(...getAttrArgs);

    expect(
      stateTracker.trackedSearches.get(cacheKey)?.map(([, id]) => id)
    ).toContain(MockObjectName.MOCK_ATTRIBUTE);
  });

  it('getAttrByName uses cached values after first search', () => {
    stateTracker.getAttrByName(...getAttrArgs);

    const findObjsSpyCallCount = findObjsSpy.mock.calls.length;

    stateTracker.getAttrByName(...getAttrArgs);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsSpyCallCount);
  });

  it('getAttrByName adds events for each search', () => {
    const cacheKey = paramsIntoKey(getAttrArgs);

    expect(stateTracker.trackedEvents.has(cacheKey)).toBe(false);

    stateTracker.getAttrByName(...getAttrArgs);

    const trackedEvents = stateTracker.trackedEvents.get(cacheKey);
    expect(trackedEvents).toBeDefined();
    expect(trackedEvents?.has('add:attribute')).toBe(true);
    expect(trackedEvents?.has('change:attribute')).toBe(true);
    expect(trackedEvents?.has('destroy:attribute')).toBe(true); // fires if related character destroyed
  });
});
