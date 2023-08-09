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

If you use LOCS and found it helpful, please make a PR and add your API to the list of Roll20 APIs using it!

## APIs using LOCS

- None :(
