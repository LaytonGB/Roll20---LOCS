/* eslint-disable @typescript-eslint/no-unused-vars */

import mockValues from './values';

function createObj(
    type: ObjectType,
    properties: { [property: string]: string }
): Roll20Object {
    const createdObj = mockValues.mockRequestResults.get(`created_${type}`);
    if (createdObj === undefined) {
        throw new Error('created object does not exist in mocked values');
    }
    return createdObj;
}

function filterObjs(callback: (obj: Roll20Object) => boolean): Roll20Object[] {
    const filteredObjects = [];
    const allObjects = mockValues.mockRequestResults.values();
    for (const currentObject of allObjects) {
        if (callback(currentObject)) {
            filteredObjects.push(currentObject);
        }
    }
    return filteredObjects;
}

function findObjs(
    properties: { [property: string]: any },
    options?: FindObjectOptions
): Roll20Object[] {
    // TODO use options to search case-insensetive with string values
    const filteredObjects = [];
    const allObjects = mockValues.mockRequestResults.values();
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

function getAttrByName(
    character_id: string,
    attribute_name: string,
    value_type: 'current' | 'max' = 'current'
) {
    const allResults = findObjs({
        type: 'attribute',
        _characterid: character_id,
        name: attribute_name,
    });
    if (allResults.length > 1) {
        throw new Error(
            'more than 1 attribute with same name exists for character'
        );
    } else if (allResults.length === 0) {
        throw new Error('no such attribute exists for character');
    }

    const attribute = allResults[0];
    return attribute.get(value_type);
}

function getObj(_type: ObjectType, id: string): Roll20Object {
    const mockIds = mockValues.mockRequestArgs.ids;
    if (!mockIds.includes(id)) {
        throw new Error('invalid mock id');
    }

    const mockResult = mockValues.mockRequestResults.get(id);
    if (!mockResult) {
        throw new Error('valid mock id returned invalid mock result');
    }

    return mockResult;
}

export default {
    createObj,
    filterObjs,
    findObjs,
    getObj,
};
