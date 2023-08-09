# Layton's Object Caching System (LOCS)

An automatic caching API for Roll20.

Replace your usual calls to Roll20 functions with calls to this API and it will automatically cache the results!

## When to use

If you repeatedly call `getObj`, `findObjs`, `filterObjs`, or `getAttrByName` with the same parameters, this works perfectly. Just use the LOCS object and it works:

```ts
const locs = Locs.new();
locs.findObjs("character", { _pageid: "example" });
```

The first time any unique query is called it will be slower than Roll20, so **do not use LOCS for one-off calls**.

Use `filterObjs` any time you want to search with changing values:

```ts
const locs = Locs.new();
const myGraphic = locs.createObj("graphic", {
  _pageid: "example",
  top: 5,
  left: 5,
});
locs.filter((otherObj) => {
  if (
    otherObj.get("_type") === "graphic" &&
    distanceBetween(myObj, otherObj) < 10
  ) {
    return true;
  }
  return false;
});
```

LOCS adds event listeners as needed to maintain the values in the cache. If an object is added, changed, or removed, LOCS will treat it accordingly across all cached values.

## All functions

### `createObj`

```ts
createObj: (type: ObjectType, properties: { [property: string]: any }) =>
  Roll20Object | undefined;
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
getAttrByName: (
  character_id: Roll20Id,
  attribute_name: string,
  value_type?: "current" | "max"
) => string;
```

### `getAttrObjByName`

Rather than getting the value of an attribute, use this method to get the object that contains the value. It uses the same cache as `getAttrByName`, so searching for an attribute in one method will cache that attribute for the other.

```ts
getAttrObjByName: (character_id: Roll20Id, attribute_name: string) =>
  Roll20Object | undefined;
```

### `getObj`

```ts
getObj: (type: ObjectType, id: Roll20Id) => Roll20Object | undefined;
```

## APIs using LOCS

If you use LOCS and found it helpful, please make a PR and add your API to the list of Roll20 APIs using it!

- None :(
