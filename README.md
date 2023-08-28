# Layton's Object Caching System (LOCS)

An automatic caching API for Roll20.

Replace your usual calls to Roll20 functions with calls to this API and it will automatically cache the results!

## When to use

If you repeatedly call `getObj`, `findObjs`, `filterObjs`, or `getAttrByName` with the same parameters, this works perfectly. Just use the LOCS object and it works:

```ts
const locs = Locs.new();
locs.findObjs('character', { _pageid: 'example' });
```

The first time any unique query is called it will be slower than Roll20, so **do not use LOCS for one-off calls**.

Use `filterObjs` carefully. If the callback function refers to changing values, the cached return will not be updated to match giving bad results!!!

Example of bad code:

```ts
let myChangingNumber = 3;
const myCallbackFunction = (obj) => obj.get('_type') === 'graphic' && obj.get('top') === myChangingNumber;
const results1 = locs.filterObjs(myCallbackFunction);
myChangingNumber = 10;
const results2 = locs.filterObjs(myCallbackFunction);
results1 === results2; // true -> because LOCS does not know that `myChangingNumber` changed value, it still returns the same stored result
```

## All functions

### `createObj`

```ts
createObj: (type: ObjectType, properties: { [property: string]: any }) => Roll20Object | undefined;
```

### `findObjs`

```ts
findObjs: (properties: { [property: string]: any }) => Roll20Object[];
```

### `filterObjs`

```ts
filterObjs: (callback: (obj: Roll20Object) => boolean) => Roll20Object[];
```

### `getAttrByName`

```ts
getAttrByName: (character_id: Roll20Id, attribute_name: string, value_type?: 'current' | 'max') => string;
```

### `getAttrObjByName`

Rather than getting the value of an attribute, use this method to get the object that contains the value. It uses the same cache as `getAttrByName`, so searching for an attribute in one method will cache that attribute for the other.

```ts
getAttrObjByName: (character_id: Roll20Id, attribute_name: string) => Roll20Object | undefined;
```

### `getObj`

```ts
getObj: (type: ObjectType, id: Roll20Id) => Roll20Object | undefined;
```

## APIs using LOCS

If you use LOCS and found it helpful, please make a PR and add your API to the list of Roll20 APIs using it!

- None :(
