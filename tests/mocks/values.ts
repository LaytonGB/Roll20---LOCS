function createRoll20Object(
    type: ObjectType,
    id: string,
    properties: { [property: string]: any } = {}
): Roll20Object {
    return {
        id,
        get: (() => {
            const validProperties: { [property: string]: any } = {
                _id: id,
                _type: type,
                ...properties,
            };
            return (property: string) => {
                const propertyValue = validProperties[property];
                if (propertyValue === undefined) {
                    throw new Error();
                }
                return propertyValue;
            };
        })(),
        remove() {
            return;
        },
    };
}

const mockObjectConstants = {
    mockGraphicTop: 30,
    mockGraphicLeft: 100,
};

export enum MockObjectName {
    CREATED_CHARACTER = 'created_character',
    MOCK_ATTRIBUTE = 'mock_attribute',
    MOCK_CHARACTER = 'mock_character',
    MOCK_GRAPHIC = 'mock_graphic',
    MOCK_PLAYER = 'mock_player',
}

const mockObjectParams: {
    type: ObjectType;
    id: string;
    properties?: { [property: string]: any };
}[] = [
    {
        type: 'attribute',
        id: 'mock_attribute',
        properties: { _characterid: 'mock_character', current: 10, max: 20 },
    },
    { type: 'character', id: 'created_character' },
    { type: 'character', id: 'mock_character' },
    {
        type: 'graphic',
        id: 'mock_graphic',
        properties: {
            top: mockObjectConstants.mockGraphicTop,
            left: mockObjectConstants.mockGraphicLeft,
        },
    },
    { type: 'player', id: 'mock_player' },
];

const mockRequestResults: Map<string, Roll20Object> = mockObjectParams.reduce(
    (map: Map<string, Roll20Object>, { type, id, properties }) => {
        map.set(id, createRoll20Object(type, id, properties));
        return map;
    },
    new Map<string, Roll20Object>()
);

const mockRequestArgs = {
    ids: Object.keys(mockRequestResults),
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
