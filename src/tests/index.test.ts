/* eslint-disable @typescript-eslint/ban-ts-comment */

import _ from 'lodash';

import { MockObjectName } from './mocks/values';
import mockValues from './mocks/values';
import mockFunctions from './mocks/functions';

import { ILocs, Roll20EventLabel, Locs } from '..';
import { MockRoll20Object } from './utils/roll20';

// @ts-ignore not assignable error because of roll20 types
global.createObj = (): void => undefined;
const createObjMock = jest.fn<Roll20Object | undefined, [ObjectType, { [property: string]: any }]>(
  mockFunctions.createObj
);
const createObjSpy = jest
  .spyOn(global, 'createObj')
  // @ts-ignore CreateObj overload causing bad-selection error
  .mockImplementation(createObjMock);

// @ts-ignore
global.getObj = (): void => undefined;
const getObjMock = jest.fn<Roll20Object | undefined, [ObjectType, string]>(mockFunctions.getObj);
const getObjSpy = jest.spyOn(global, 'getObj').mockImplementation(getObjMock);

// @ts-ignore
global.findObjs = (): void => undefined;
const findObjsMock = jest.fn<Roll20Object[], [{ [property: string]: any }]>(mockFunctions.findObjs);
const findObjsSpy = jest.spyOn(global, 'findObjs').mockImplementation(findObjsMock);

// @ts-ignore
global.filterObjs = (): void => undefined;
const filterObjsMock = jest.fn<Roll20Object[], [(obj: Roll20Object) => boolean]>(mockFunctions.filterObjs);
const filterObjsSpy = jest.spyOn(global, 'filterObjs').mockImplementation(filterObjsMock);

const { triggerEvent, on } = mockFunctions.getOnFunctions();
// @ts-ignore
global.on = (): void => undefined;
const onMock = jest.fn<void, [Roll20EventLabel, (obj: Roll20Object) => void]>(on);
// @ts-ignore On overload causing bad-selection error
/* const onSpy = */ jest.spyOn(global, 'on').mockImplementation(onMock);

global.log = (): void => undefined;
const logMock = jest.fn<void, [string]>(mockFunctions.log);
/* const logSpy = */ jest.spyOn(global, 'log').mockImplementation(logMock);

describe('state constructor', () => {
  it('can be created with no input', () => {
    const locs = Locs.new();

    expect(locs).toBeDefined();
  });
});

describe('object fetching', () => {
  const getArgsType = 'player';
  const getArgsId = MockObjectName.MOCK_PLAYER;
  const getArgs: [ObjectType, string] = [getArgsType, getArgsId];

  let locs: ILocs;
  beforeEach(() => {
    locs = Locs.new();
  });

  it('makes calls for uncached values to roll20', () => {
    expect(getObjSpy).not.toHaveBeenCalled();

    const fetchedCharacter = locs.getObj(...getArgs);

    expect(fetchedCharacter).toBeDefined();
    expect(typeof fetchedCharacter?.id).toBe('string');
    expect(getObjSpy).toHaveBeenCalledTimes(1);
  });
});

describe('object and property caching', () => {
  const getArgsType = 'graphic';
  const getArgsId = MockObjectName.MOCK_GRAPHIC;
  const getArgs: ['graphic', string] = [getArgsType, getArgsId];

  let locs: ILocs;
  beforeEach(() => {
    locs = Locs.new();
  });

  it('caches fetched objects', () => {
    locs.getObj(...getArgs);

    const getObjCallCount = getObjSpy.mock.calls.length;

    locs.getObj(...getArgs);

    expect(getObjSpy).toBeCalledTimes(getObjCallCount);
  });

  describe('events', () => {
    beforeEach(() => {
      locs = Locs.new();
    });

    it('cached objects update when fetched objects are changed', () => {
      const newTopValue = 15;

      const cachedObject = locs.getObj(...getArgs);
      const fetchedObject = getObj(...getArgs);
      fetchedObject?.set('top', newTopValue);

      expect(cachedObject?.get('top')).toBe(newTopValue);
    });

    it('removes cache entries on destroy', () => {
      const cachedObject = locs.getObj(...getArgs);
      const getObjCallCount = getObjSpy.mock.calls.length;

      triggerEvent('destroy', 'graphic', cachedObject as Roll20Object);

      locs.getObj(...getArgs);

      expect(getObjSpy).toHaveBeenCalledTimes(getObjCallCount + 1);
    });

    afterAll(() => {
      locs = Locs.new();
      const locsResult = locs.getObj(...getArgs);
      locsResult?.set('top', mockValues.mockObjectConstants.mockGraphicTop);
    });
  });
});

describe('createObj', () => {
  const newObjType = 'graphic';
  const newObjParams = {
    top: mockValues.mockObjectConstants.mockGraphicTop,
  };

  let locs: ILocs;
  beforeEach(() => {
    locs = Locs.new();
  });

  it('creates an object that is immediately cached', () => {
    const newObject = locs.createObj(newObjType, newObjParams);
    if (!newObject) {
      throw new Error('Failed to create object');
    }

    const newObjId = newObject.id;
    const getObjCallCount = getObjSpy.mock.calls.length;
    locs.getObj(newObjType, newObjId);

    expect(getObjSpy).toHaveBeenCalledTimes(getObjCallCount);
  });

  it('triggers the roll20 add events', () => {
    const createObjCallCount = createObjSpy.mock.calls.length;
    locs.createObj(newObjType, newObjParams);

    expect(createObjSpy).toHaveBeenCalledTimes(createObjCallCount + 1);
  });
});

describe('findObjs', () => {
  const objSearchResultIds = [MockObjectName.CREATED_GRAPHIC, MockObjectName.MOCK_GRAPHIC];

  const objSearchType = 'graphic' as ObjectType;
  const objSearchParams = {
    _type: objSearchType,
    top: mockValues.mockObjectConstants.mockGraphicTop,
  };

  const noResultsSearchParams = {
    _type: 'page',
    top: mockValues.mockObjectConstants.mockGraphicTop,
  };

  let locs: ILocs;
  beforeEach(() => {
    locs = Locs.new();
  });

  it('finds relevant items', () => {
    const foundObjects = locs.findObjs(objSearchParams);

    expect(foundObjects).toHaveLength(2);

    const foundObjectIds = foundObjects.map((obj) => obj.id);
    expect(foundObjectIds).toMatchObject(objSearchResultIds);

    const cachedSearchObjects = locs.findObjs(objSearchParams);
    const cachedObjectIds = cachedSearchObjects.map((obj) => obj.id);

    expect(cachedObjectIds).toMatchObject(objSearchResultIds);
  });

  it('caches previous searches', () => {
    locs.findObjs(objSearchParams);
    const findObjsCallCount = findObjsSpy.mock.calls.length;

    locs.findObjs(objSearchParams);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('is agnostic about the order of properties', () => {
    locs.findObjs(objSearchParams);
    const findObjsCallCount = findObjsSpy.mock.calls.length;
    locs.findObjs({
      top: mockValues.mockObjectConstants.mockGraphicTop,
      _type: objSearchType,
    });

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('still returns items if type is excluded', () => {
    const searchParamsWithoutType = {
      top: mockValues.mockObjectConstants.mockGraphicTop,
    };

    const findWithoutTypeResults = locs.findObjs(searchParamsWithoutType);

    expect(findWithoutTypeResults).toHaveLength(2);

    const findObjsCallCount = findObjsSpy.mock.calls.length;
    locs.findObjs(searchParamsWithoutType);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('caches even when no results are found', () => {
    const noResultsSearchResults = locs.findObjs(noResultsSearchParams);

    expect(noResultsSearchResults).toHaveLength(0);

    const findObjsCallCount = findObjsSpy.mock.calls.length;
    locs.findObjs(noResultsSearchParams);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  describe('tracks updates to maintain find results', () => {
    const eventGraphicId = 'on_graphic';

    let findObjsResults: Roll20Object[];
    beforeEach(() => {
      locs = Locs.new();
      findObjsResults = locs.findObjs(objSearchParams);
    });

    it('adds new results to cache when matching object created', () => {
      const newObject = new MockRoll20Object('graphic', eventGraphicId, {
        top: mockValues.mockObjectConstants.mockGraphicTop,
      });

      triggerEvent('add', 'graphic', newObject);

      const newSearchResults = locs.findObjs(objSearchParams);

      expect(newSearchResults).toContain(newObject);
    });

    it('removes entries from cache when matching object destroyed', () => {
      const idToBeRemoved = findObjsResults[0].id;
      const objToBeRemoved = mockValues.mockRequestResults.get(idToBeRemoved) as Roll20Object;

      triggerEvent('destroy', 'graphic', objToBeRemoved);

      const newSearchResults = locs.findObjs(objSearchParams);

      expect(newSearchResults).not.toContain(objToBeRemoved);
    });

    it('adds new results to cache when object changed to match', () => {
      const createdObj: Roll20Object = new MockRoll20Object(objSearchType, `FINDOBJS_CACHE_CREATED_${objSearchType}`, {
        top: 180,
      });
      triggerEvent('add', `${createdObj.get('_type') as ObjectType}`, createdObj);

      const initialFindObjsResultsLength = locs.findObjs(objSearchParams).length;

      const oldObj = _.cloneDeep(createdObj);
      createdObj.set('top', objSearchParams.top);
      triggerEvent('change', `${createdObj.get('_type') as ObjectType}`, createdObj, oldObj);

      expect(locs.findObjs(objSearchParams)).toHaveLength(initialFindObjsResultsLength + 1);
    });

    it('removes results when existing entry changed to not match', () => {
      const createdObj: Roll20Object = new MockRoll20Object(objSearchType, `FINDOBJS_CACHE_CREATED_${objSearchType}`, {
        top: objSearchParams.top,
      });
      triggerEvent('add', `${createdObj.get('_type') as ObjectType}`, createdObj);

      const initialFindObjsResultsLength = locs.findObjs(objSearchParams).length;

      const oldObj = _.cloneDeep(createdObj);
      createdObj.set('top', 180);
      triggerEvent('change', `${createdObj.get('_type') as ObjectType}`, createdObj, oldObj);

      expect(locs.findObjs(objSearchParams)).toHaveLength(initialFindObjsResultsLength - 1);
    });
  });
});

describe('filterObjs', () => {
  function newBasicFilterFromParams(params: { [param: string]: any }) {
    return (obj: Roll20Object): boolean => Object.entries(params).every(([param, value]) => obj.get(param) === value);
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
  const noResultsSearchFilterFunc = newBasicFilterFromParams(noResultsSearchParams);

  let locs: ILocs;
  beforeEach(() => {
    locs = Locs.new();
  });

  it('finds relevant items', () => {
    const resultsWith2Matches = locs.filterObjs(objSearchFilterFunc);

    expect(resultsWith2Matches).toHaveLength(2);

    const resultsWith0Matches = locs.filterObjs(noResultsSearchFilterFunc);

    expect(resultsWith0Matches).toHaveLength(0);
  });

  it('caches previous searches', () => {
    const initialFilterObjsCalls = filterObjsSpy.mock.calls.length;
    locs.filterObjs(objSearchFilterFunc);
    locs.filterObjs(objSearchFilterFunc);

    expect(filterObjsSpy).toHaveBeenCalledTimes(initialFilterObjsCalls + 1);
  });

  it('caches even when no results are found', () => {
    const initialFilterObjsCalls = filterObjsSpy.mock.calls.length;
    locs.filterObjs(noResultsSearchFilterFunc);
    locs.filterObjs(noResultsSearchFilterFunc);

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
      locs = Locs.new();
      locs.filterObjs(cacheCheckFilterFunc);
    });

    it('adds new results to cache when any matching object created', () => {
      allObjectTypes.forEach((objType) => {
        const initialFilterObjsResultsLength = locs.filterObjs(cacheCheckFilterFunc).length;

        triggerEvent(
          'add',
          `${objType}`,
          new MockRoll20Object(objType, `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`, { test: true })
        );

        expect(locs.filterObjs(cacheCheckFilterFunc)).toHaveLength(initialFilterObjsResultsLength + 1);
      });
    });

    it('removes entries from cache when matching object destroyed', () => {
      const createdObjs: Roll20Object[] = allObjectTypes.map(
        (objType) => new MockRoll20Object(objType, `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`, { test: true })
      );

      // fill filterObjs results with a result of each type
      createdObjs.forEach((createdObj) => {
        triggerEvent('add', `${createdObj.get('_type') as ObjectType}`, createdObj);
      });

      createdObjs.forEach((createdObj) => {
        const initialFilterObjsResultsLength = locs.filterObjs(cacheCheckFilterFunc).length;

        triggerEvent('destroy', `${createdObj.get('_type') as ObjectType}`, createdObj);

        expect(locs.filterObjs(cacheCheckFilterFunc)).toHaveLength(initialFilterObjsResultsLength - 1);
      });
    });

    it('adds new results to cache when object changed to match', () => {
      const createdObjs: Roll20Object[] = allObjectTypes.map(
        (objType) => new MockRoll20Object(objType, `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`, { test: false })
      );

      createdObjs.forEach((createdObj) => {
        const initialFilterObjsResultsLength = locs.filterObjs(cacheCheckFilterFunc).length;

        const oldObj = _.cloneDeep(createdObj);
        createdObj.set('test', true);
        triggerEvent('change', `${createdObj.get('_type') as ObjectType}`, createdObj, oldObj);

        expect(locs.filterObjs(cacheCheckFilterFunc)).toHaveLength(initialFilterObjsResultsLength + 1);
      });
    });

    it('removes results when existing entry changed to not match', () => {
      const createdObjs: Roll20Object[] = allObjectTypes.map(
        (objType) => new MockRoll20Object(objType, `FILTEROBJS_CACHE_CREATED_${objType.toUpperCase()}`, { test: true })
      );

      // fill filterObjs results with a result of each type
      createdObjs.forEach((createdObj) => {
        triggerEvent('add', `${createdObj.get('_type') as ObjectType}`, createdObj);
      });

      createdObjs.forEach((createdObj) => {
        const initialFilterObjsResultsLength = locs.filterObjs(cacheCheckFilterFunc).length;

        const oldObj = _.cloneDeep(createdObj);
        createdObj.set('test', false);
        triggerEvent('change', `${createdObj.get('_type') as ObjectType}`, createdObj, oldObj);

        expect(locs.filterObjs(cacheCheckFilterFunc)).toHaveLength(initialFilterObjsResultsLength - 1);
      });
    });
  });
});

describe('getAttrByName and getAttrObjByName', () => {
  const getAttrCharacterId = MockObjectName.MOCK_CHARACTER;
  const getAttrArgs: [string, string] = [getAttrCharacterId, 'hp'];

  let locs: ILocs;
  beforeEach(() => {
    locs = Locs.new();
  });

  it('getAttrObjByName caches each search', () => {
    locs.getAttrObjByName(...getAttrArgs);
    const findObjsCallCount = findObjsSpy.mock.calls.length;
    locs.getAttrObjByName(...getAttrArgs);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('getAttrByName caches each search', () => {
    locs.getAttrByName(...getAttrArgs);
    const findObjsCallCount = findObjsSpy.mock.calls.length;
    locs.getAttrByName(...getAttrArgs);

    expect(findObjsSpy).toHaveBeenCalledTimes(findObjsCallCount);
  });

  it('event checks', () => {
    const getAttrResult = locs.getAttrObjByName(...getAttrArgs) as Roll20Object;
    const oldResult = _.cloneDeep(getAttrResult);
    getAttrResult?.set('name', 'new_name');
    triggerEvent('change', 'attribute', getAttrResult, oldResult);

    const newGetAttrResult = locs.getAttrObjByName(...getAttrArgs);
    expect(newGetAttrResult).toBeUndefined();
  });
});
