import { MockRoll20Object } from '../utils/roll20';

const mockObjectConstants = {
  mockGraphicTop: 30,
  mockGraphicLeft: 100,
};

export enum MockObjectName {
  CREATED_CHARACTER = 'created_character',
  CREATED_GRAPHIC = 'created_graphic',
  MOCK_ATTRIBUTE = 'mock_attribute',
  MOCK_CHARACTER = 'mock_character',
  MOCK_GRAPHIC = 'mock_graphic',
  MOCK_PAGE = 'mock_page',
  MOCK_PLAYER = 'mock_player',
}

const mockObjectParams: {
  type: ObjectType;
  id: string;
  properties?: { [property: string]: any };
}[] = [
  {
    type: 'attribute',
    id: MockObjectName.MOCK_ATTRIBUTE,
    properties: {
      _characterid: MockObjectName.MOCK_CHARACTER,
      current: 10,
      max: 20,
    },
  },
  { type: 'character', id: MockObjectName.CREATED_CHARACTER },
  { type: 'character', id: MockObjectName.MOCK_CHARACTER },
  {
    type: 'graphic',
    id: MockObjectName.CREATED_GRAPHIC,
    properties: {
      top: mockObjectConstants.mockGraphicTop,
      left: mockObjectConstants.mockGraphicLeft,
    },
  },
  {
    type: 'graphic',
    id: MockObjectName.MOCK_GRAPHIC,
    properties: {
      top: mockObjectConstants.mockGraphicTop,
      left: mockObjectConstants.mockGraphicLeft,
    },
  },
  { type: 'page', id: MockObjectName.MOCK_PAGE },
  { type: 'player', id: MockObjectName.MOCK_PLAYER },
];

const mockRequestResults: Map<string, Roll20Object> = mockObjectParams.reduce(
  (map: Map<string, Roll20Object>, { type, id, properties }) => {
    map.set(id, new MockRoll20Object(type, id, properties));
    return map;
  },
  new Map<string, Roll20Object>()
);

const mockRequestArgs = {
  ids: [...mockRequestResults.keys()],
  trackerConfig: {
    trackedAttributes: ['hp'],
    trackedCharacterProperties: ['name'],
    trackedGraphicProperties: ['top', 'left'],
  },
};

export default {
  mockObjectConstants,
  mockRequestArgs,
  mockRequestResults,
};
