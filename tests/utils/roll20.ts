export function createRoll20Object(
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
                    throw new Error('property not defined');
                }
                return propertyValue;
            };
        })(),
        remove() {
            return;
        },
    };
}
