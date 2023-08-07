/* eslint-disable @typescript-eslint/ban-ts-comment */

import { MockObjectName } from './mocks/values';
import mockValues from './mocks/values';
import mockFunctions from './mocks/functions';

import { IStateTracker, Roll20EventLabel, TokenStateApi } from '..';
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

// @ts-ignore
global.filterObjs = () => {
  return;
};
const filterObjsMock = jest.fn<
  Roll20Object[],
  [(obj: Roll20Object) => boolean]
>(mockFunctions.filterObjs);
const filterObjsSpy = jest
  .spyOn(global, 'filterObjs')
  .mockImplementation(filterObjsMock);

const { triggerEvent, on } = mockFunctions.getOnFunctions();
// @ts-ignore
global.on = () => {
  return;
};
const onMock = jest.fn<void, [Roll20EventLabel, (obj: Roll20Object) => void]>(
  on
);
// @ts-ignore On overload causing bad-selection error
/* const onSpy = */ jest.spyOn(global, 'on').mockImplementation(onMock);

global.log = () => {
  return;
};
const logMock = jest.fn<void, [string]>(mockFunctions.log);
/* const logSpy = */ jest.spyOn(global, 'log').mockImplementation(logMock);

describe('state constructor', () => {
  it('can be created with no input', () => {
    const stateTracker = TokenStateApi.createStateTracker();

    expect(stateTracker).toBeDefined();
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

  it('makes calls for uncached values to roll20', () => {
    expect(getObjSpy).not.toHaveBeenCalled();

    const fetchedCharacter = stateTracker.getObj(...getArgs);

    expect(fetchedCharacter).toBeDefined();
    expect(typeof fetchedCharacter?.id).toBe('string');
    expect(getObjSpy).toHaveBeenCalledTimes(1);
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

    const getObjCallCount = getObjSpy.mock.calls.length;

    stateTracker.getObj(...getArgs);

    expect(getObjSpy).toBeCalledTimes(getObjCallCount);
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
      const getObjCallCount = getObjSpy.mock.calls.length;

      triggerEvent('destroy:graphic', cachedObject as Roll20Object);

      stateTracker.getObj(...getArgs);

      expect(getObjSpy).toHaveBeenCalledTimes(getObjCallCount + 1);
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

describe('findObjs', () => {
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

    expect(foundObjects).toHaveLength(2);

    const foundObjectIds = foundObjects.map((obj) => obj.id);
    expect(foundObjectIds).toMatchObject(objSearchResultIds);

    const cachedSearchObjects = stateTracker.findObjs(objSearchParams);
    const cachedObjectIds = cachedSearchObjects.map((obj) => obj.id);

    expect(cachedObjectIds).toMatchObject(objSearchResultIds);
  });

  it('caches previous searches', () => {
    stateTracker.findObjs(objSearchParams);
    const findObjsCallCount = findObjsSpy.mock.calls.length;

    stateTracker.findObjs(objSearchParams);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('still returns items if type is excluded', () => {
    const searchParamsWithoutType = {
      top: mockValues.mockObjectConstants.mockGraphicTop,
    };

    const findWithoutTypeResults = stateTracker.findObjs(
      searchParamsWithoutType
    );

    expect(findWithoutTypeResults).toHaveLength(2);

    const findObjsCallCount = findObjsSpy.mock.calls.length;
    stateTracker.findObjs(searchParamsWithoutType);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('caches even when no results are found', () => {
    const noResultsSearchResults = stateTracker.findObjs(noResultsSearchParams);

    expect(noResultsSearchResults).toHaveLength(0);

    const findObjsCallCount = findObjsSpy.mock.calls.length;
    stateTracker.findObjs(noResultsSearchParams);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  describe('tracks updates to maintain find results', () => {
    const eventGraphicId = 'on_graphic';

    let findObjsResults: Roll20Object[];
    beforeEach(() => {
      stateTracker = TokenStateApi.createStateTracker();
      findObjsResults = stateTracker.findObjs(objSearchParams);
    });

    it('adds new results to cache when matching object created', () => {
      const newObject = new MockRoll20Object('graphic', eventGraphicId, {
        top: mockValues.mockObjectConstants.mockGraphicTop,
      });

      triggerEvent('add:graphic', newObject);

      const newSearchResults = stateTracker.findObjs(objSearchParams);

      expect(newSearchResults).toContain(newObject);
    });

    it('removes entries from cache when matching object destroyed', () => {
      const idToBeRemoved = findObjsResults[0].id;
      const objToBeRemoved = mockValues.mockRequestResults.get(
        idToBeRemoved
      ) as Roll20Object;

      triggerEvent('destroy:graphic', objToBeRemoved);

      const newSearchResults = stateTracker.findObjs(objSearchParams);

      expect(newSearchResults).not.toContain(objToBeRemoved);
    });

    it('adds new results to cache when object changed to match', () => {
      const createdObj: Roll20Object = new MockRoll20Object(
        objSearchType,
        `FINDOBJS_CACHE_CREATED_${objSearchType}`,
        { top: 180 }
      );
      triggerEvent(`add:${createdObj.get('_type')}`, createdObj);

      const initialFindObjsResultsLength =
        stateTracker.findObjs(objSearchParams).length;

      createdObj.set('top', objSearchParams.top);
      triggerEvent(`change:${createdObj.get('_type')}`, createdObj);

      expect(stateTracker.findObjs(objSearchParams)).toHaveLength(
        initialFindObjsResultsLength + 1
      );
    });

    it('removes results when existing entry changed to not match', () => {
      const createdObj: Roll20Object = new MockRoll20Object(
        objSearchType,
        `FINDOBJS_CACHE_CREATED_${objSearchType}`,
        { top: objSearchParams.top }
      );
      triggerEvent(`add:${createdObj.get('_type')}`, createdObj);

      const initialFindObjsResultsLength =
        stateTracker.findObjs(objSearchParams).length;

      createdObj.set('top', 180);
      triggerEvent(`change:${createdObj.get('_type')}`, createdObj);

      expect(stateTracker.findObjs(objSearchParams)).toHaveLength(
        initialFindObjsResultsLength - 1
      );
    });
  });
});

describe('filterObjs', () => {
  function newBasicFilterFromParams(params: { [param: string]: any }) {
    return (obj: Roll20Object) => {
      return Object.entries(params).every(
        ([param, value]) => obj.get(param) === value
      );
    };
  }

  const objSearchType = 'graphic';
  const objSearchParams = {
    _type: objSearchType,
    top: mockValues.mockObjectConstants.mockGraphicTop,
  };
  const objSearchFilterFunc = newBasicFilterFromParams(objSearchParams);

  const noResultsSearchParams = {
    _type: 'page',
    top: mockValues.mockObjectConstants.mockGraphicTop,
  };
  const noResultsSearchFilterFunc = newBasicFilterFromParams(
    noResultsSearchParams
  );

  let stateTracker: IStateTracker;
  beforeEach(() => {
    stateTracker = TokenStateApi.createStateTracker();
  });

  it('finds relevant items', () => {
    const resultsWith2Matches = stateTracker.filterObjs(objSearchFilterFunc);

    expect(resultsWith2Matches).toHaveLength(2);

    const resultsWith0Matches = stateTracker.filterObjs(
      noResultsSearchFilterFunc
    );

    expect(resultsWith0Matches).toHaveLength(0);
  });

  it('caches previous searches', () => {
    const initialFilterObjsCalls = filterObjsSpy.mock.calls.length;
    stateTracker.filterObjs(objSearchFilterFunc);
    stateTracker.filterObjs(objSearchFilterFunc);

    expect(filterObjsSpy).toHaveBeenCalledTimes(initialFilterObjsCalls + 1);
  });

  it('caches even when no results are found', () => {
    const initialFilterObjsCalls = filterObjsSpy.mock.calls.length;
    stateTracker.filterObjs(noResultsSearchFilterFunc);
    stateTracker.filterObjs(noResultsSearchFilterFunc);

    expect(filterObjsSpy).toHaveBeenCalledTimes(initialFilterObjsCalls + 1);
  });

  describe('tracks updates to maintain find results', () => {
    const allObjectTypes: ObjectType[] = [
      'graphic',
      'text',
      'path',
      'character',
      'ability',
      'attribute',
      'handout',
      'rollabletable',
      'tableitem',
      'macro',
      'campaign',
      'player',
      'page',
    ];
    const cacheCheckFilterFunc = newBasicFilterFromParams({ test: true });

    beforeEach(() => {
      stateTracker = TokenStateApi.createStateTracker();
      stateTracker.filterObjs(cacheCheckFilterFunc);
    });

    it('adds new results to cache when any matching object created', () => {
      allObjectTypes.forEach((objType) => {
        const initialFilterObjsResultsLength =
          stateTracker.filterObjs(cacheCheckFilterFunc).length;

        triggerEvent(
          `add:${objType}`,
          new MockRoll20Object(
            objType,
            `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`,
            { test: true }
          )
        );

        expect(stateTracker.filterObjs(cacheCheckFilterFunc)).toHaveLength(
          initialFilterObjsResultsLength + 1
        );
      });
    });

    it('removes entries from cache when matching object destroyed', () => {
      const createdObjs: Roll20Object[] = allObjectTypes.map((objType) => {
        return new MockRoll20Object(
          objType,
          `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`,
          { test: true }
        );
      });

      // fill filterObjs results with a result of each type
      createdObjs.forEach((createdObj) => {
        triggerEvent(`add:${createdObj.get('_type')}`, createdObj);
      });

      createdObjs.forEach((createdObj) => {
        const initialFilterObjsResultsLength =
          stateTracker.filterObjs(cacheCheckFilterFunc).length;

        triggerEvent(`destroy:${createdObj.get('_type')}`, createdObj);

        expect(stateTracker.filterObjs(cacheCheckFilterFunc)).toHaveLength(
          initialFilterObjsResultsLength - 1
        );
      });
    });

    it('adds new results to cache when object changed to match', () => {
      const createdObjs: Roll20Object[] = allObjectTypes.map((objType) => {
        return new MockRoll20Object(
          objType,
          `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`,
          { test: false }
        );
      });

      createdObjs.forEach((createdObj) => {
        const initialFilterObjsResultsLength =
          stateTracker.filterObjs(cacheCheckFilterFunc).length;

        createdObj.set('test', true);

        triggerEvent(`change:${createdObj.get('_type')}`, createdObj);

        expect(stateTracker.filterObjs(cacheCheckFilterFunc)).toHaveLength(
          initialFilterObjsResultsLength + 1
        );
      });
    });

    it('removes results when existing entry changed to not match', () => {
      const createdObjs: Roll20Object[] = allObjectTypes.map((objType) => {
        return new MockRoll20Object(
          objType,
          `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`,
          { test: true }
        );
      });

      // fill filterObjs results with a result of each type
      createdObjs.forEach((createdObj) => {
        triggerEvent(`add:${createdObj.get('_type')}`, createdObj);
      });

      createdObjs.forEach((createdObj) => {
        const initialFilterObjsResultsLength =
          stateTracker.filterObjs(cacheCheckFilterFunc).length;

        createdObj.set('test', false);
        triggerEvent(`change:${createdObj.get('_type')}`, createdObj);

        expect(stateTracker.filterObjs(cacheCheckFilterFunc)).toHaveLength(
          initialFilterObjsResultsLength - 1
        );
      });
    });
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
    stateTracker.getAttrObjByName(...getAttrArgs);
    const findObjsCallCount = findObjsSpy.mock.calls.length;
    stateTracker.getAttrObjByName(...getAttrArgs);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('getAttrByName caches each search', () => {
    stateTracker.getAttrByName(...getAttrArgs);
    const findObjsCallCount = findObjsSpy.mock.calls.length;
    stateTracker.getAttrByName(...getAttrArgs);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it.todo('event checks');
});
