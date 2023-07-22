import mockedValues from './values.test';

function createObj(
    type: ObjectType,
    properties: { [property: string]: string }
): Roll20Object {
    const createdObj = mockedValues.mockedRequestResults.get('created_mock_1');
    if (createdObj === undefined) {
        throw new Error();
    }
    return createdObj;
}

function findObjs(
    properties: { [property: string]: any },
    options?: FindObjectOptions
): Roll20Object[] {
    const filteredObjects = [];
    const allObjects = mockedValues.mockedRequestResults.values();
    outer: for (const currentObject of allObjects) {
        for (const [property, searchValue] of Object.entries(properties)) {
            const currentValue = currentObject.get(property);
            if (currentValue !== searchValue) {
                continue outer;
            }
        }
        filteredObjects.push(currentObject);
    }
    return filteredObjects;
}

function getObj(_type: ObjectType, id: string): Roll20Object {
    const mockIds = mockedValues.mockedRequestArgs.ids;
    if (!mockIds.includes(id)) {
        throw new Error('invalid mock id');
    }

    const mockResults = mockedValues.mockedRequestResults;
    return mockResults[id];
}

export default {
    createObj,
    getObj,
};
