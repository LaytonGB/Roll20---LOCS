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

const mockedObjectParams: {
    type: ObjectType;
    id: string;
    properties?: { [property: string]: any };
}[] = [
    { type: 'character', id: 'mock_character' },
    { type: 'graphic', id: 'mock_graphic' },
    { type: 'player', id: 'mock_player' },
];

const mockedRequestResults: Map<string, Roll20Object> =
    mockedObjectParams.reduce(
        (map: Map<string, Roll20Object>, { type, id, properties }) => {
            map.set(id, createRoll20Object(type, id, properties));
            return map;
        },
        new Map<string, Roll20Object>()
    );

const mockedRequestArgs = {
    ids: Object.keys(mockedRequestResults),
    trackerConfig: {
        trackedAttributes: ['hp'],
        trackedCharacterProperties: ['name'],
        trackedGraphicProperties: ['top', 'left'],
    },
};

export default {
    mockedRequestArgs,
    mockedRequestResults,
};
