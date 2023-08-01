export function newRoll20Object(
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
      return (property: string): any | undefined => {
        const propertyValue = validProperties[property];
        return propertyValue;
      };
    })(),
    remove() {
      return;
    },
  };
}
