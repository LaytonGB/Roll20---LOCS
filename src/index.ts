/* eslint-disable @typescript-eslint/ban-ts-comment */

export type EventType = 'add' | 'change' | 'destroy';
export type Roll20Id = string;
export type Roll20EventLabel = string;
export type SearchKey = string;

export interface ILocsFactory {
  new: () => ILocs;
}

interface IEventHandler {
  fire(...objs: Roll20Object[]): void;
  subscribe(callback: (obj: Roll20Object) => void): void;
  subscribeUntilFired(callback: (obj: Roll20Object) => void): void;
  unsubscribe(callback: (obj: Roll20Object) => void): void;
}

interface ICreateObj {
  (type: 'attribute', properties: { [property: string]: any }):
    | Attribute
    | undefined;
  (type: 'graphic', properties: { [property: string]: any }):
    | Graphic
    | undefined;
}

interface IFindObjs {
  (properties: { _type: 'text' } & { [property: string]: any }): Text[];
  (properties: { _type: 'graphic' } & { [property: string]: any }): Graphic[];
  (
    properties: { _type: 'character' } & { [property: string]: any }
  ): Character[];
  (
    properties: { _type: 'attribute' } & { [property: string]: any }
  ): Attribute[];
  (properties: { _type: 'ability' } & { [property: string]: any }): Ability[];
  (properties: { _type: 'player' } & { [property: string]: any }): Player[];
  (properties: { _type: 'macro' } & { [property: string]: any }): Macro[];
  (properties: { _type: 'page' } & { [property: string]: any }): Page[];
  (properties: { [property: string]: any }): Roll20Object[];
}

interface IFilterObjs {
  (callback: (obj: Roll20Object) => boolean): Roll20Object[];
}

interface IGetAttrByName {
  (
    character_id: Roll20Id,
    attribute_name: string,
    value_type?: 'current' | 'max'
  ): string;
}

interface IGetAttrObjByName {
  (character_id: Roll20Id, attribute_name: string): Attribute | undefined;
}

interface IGetObj {
  (type: 'text', id: string): Text | undefined;
  (type: 'graphic', id: string): Graphic | undefined;
  (type: 'character', id: string): Character | undefined;
  (type: 'attribute', id: string): Attribute | undefined;
  (type: 'ability', id: string): Ability | undefined;
  (type: 'player', id: string): Player | undefined;
  (type: 'macro', id: string): Macro | undefined;
  (type: 'page', id: string): Page | undefined;
  (type: ObjectType, id: string): Roll20Object | undefined;
}

export interface ILocs {
  createObj: ICreateObj;
  findObjs: IFindObjs;
  filterObjs: IFilterObjs;
  getAttrByName: IGetAttrByName;
  getAttrObjByName: IGetAttrObjByName;
  getObj: IGetObj;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const Locs: ILocsFactory = (() => {
  function getEventHandler(roll20EventLabel: Roll20EventLabel): IEventHandler {
    const subscribers: [(...objs: Roll20Object[]) => void, boolean][] = [];

    function fire(...objs: Roll20Object[]): void {
      const indexesToRemove: number[] = [];
      subscribers.forEach(([subscriberCallback, removeAfterFiring], index) => {
        subscriberCallback(...objs);
        if (removeAfterFiring) {
          indexesToRemove.push(index);
        }
      });

      for (const index of indexesToRemove) {
        subscribers.splice(index, 1);
      }
    }

    function subscribe(callback: (obj: Roll20Object) => void): void {
      subscribers.push([callback, false]);
    }

    function subscribeUntilFired(callback: (obj: Roll20Object) => void): void {
      subscribers.push([callback, true]);
    }

    function unsubscribe(callback: (obj: Roll20Object) => void): void {
      const foundCallbackIndex = subscribers.findIndex(
        ([storedCallback]) => storedCallback === callback
      );
      if (foundCallbackIndex === -1) {
        log(
          'WARN: cannot unsubscribe a callback function that is not already subscribed'
        );
        return;
      }

      subscribers.splice(foundCallbackIndex, 1);
    }

    // @ts-ignore Does not correctly identify `on` overloads
    on(roll20EventLabel, fire);

    return {
      fire,
      subscribe,
      subscribeUntilFired,
      unsubscribe,
    };
  }

  const getLocs = (): ILocs => {
    const eventHandlers = new Map<Roll20EventLabel, IEventHandler>();
    const cache = {
      objects: new Map<Roll20Id, Roll20Object>(),
      events: new Map<
        Roll20Id | SearchKey,
        Map<Roll20EventLabel, (...eventDetails: Roll20Object[]) => void>
      >(),
      finds: new Map<SearchKey, Roll20Object[]>(),
      filters: new Map<(obj: Roll20Object) => boolean, Roll20Object[]>(),
    };

    function cacheObject(obj: Roll20Object): void {
      cache.objects.set(obj.id, obj);
      if (!cache.events.has(obj.id)) {
        const events = new Map<Roll20EventLabel, (obj: Roll20Object) => void>();
        cache.events.set(obj.id, events);

        const destroyEventLabel = `destroy:${obj.get('_type')}`;
        const destroyCallback = () => {
          cache.objects.delete(obj.id);
          cache.events.delete(obj.id);
        };
        events.set(destroyEventLabel, destroyCallback);
        watchEventOnce(destroyEventLabel, destroyCallback);
      }
    }

    function getOrCreateEvent(eventLabel: Roll20EventLabel): IEventHandler {
      let event = eventHandlers.get(eventLabel);
      if (!event) {
        event = getEventHandler(eventLabel);
        eventHandlers.set(eventLabel, event);
      }
      return event;
    }

    function keyFromSearchArgs(parameters: {
      [parameter: string]: any;
    }): string {
      return Object.entries(parameters)
        .sort()
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    }

    function watchEvent(
      eventLabel: Roll20EventLabel,
      callback: (...objs: Roll20Object[]) => void
    ): void {
      const event = getOrCreateEvent(eventLabel);
      event.subscribe(callback);
    }

    function watchEventOnce(
      eventLabel: Roll20EventLabel,
      callback: (obj: Roll20Object) => void
    ): void {
      const event = getOrCreateEvent(eventLabel);
      event.subscribeUntilFired(callback);
    }

    function locsCreateObj(
      type: 'attribute',
      properties: { [property: string]: any }
    ): Attribute | undefined;
    function locsCreateObj(
      type: 'graphic',
      properties: { [property: string]: any }
    ): Graphic | undefined;
    function locsCreateObj(
      type: ObjectType,
      properties: { [property: string]: any }
    ): Roll20Object | undefined {
      // @ts-ignore not assignable error because of roll20 types
      const newObject = createObj(type, properties);
      if (newObject) {
        cacheObject(newObject);
        return newObject;
      }
    }

    function locsFindObjs(
      properties: { _type: 'text' } & { [property: string]: any }
    ): Text[];
    function locsFindObjs(
      properties: { _type: 'graphic' } & { [property: string]: any }
    ): Graphic[];
    function locsFindObjs(
      properties: { _type: 'character' } & { [property: string]: any }
    ): Character[];
    function locsFindObjs(
      properties: { _type: 'attribute' } & { [property: string]: any }
    ): Attribute[];
    function locsFindObjs(
      properties: { _type: 'ability' } & { [property: string]: any }
    ): Ability[];
    function locsFindObjs(
      properties: { _type: 'player' } & { [property: string]: any }
    ): Player[];
    function locsFindObjs(
      properties: { _type: 'macro' } & { [property: string]: any }
    ): Macro[];
    function locsFindObjs(
      properties: { _type: 'page' } & { [property: string]: any }
    ): Page[];
    function locsFindObjs(properties: {
      [property: string]: any;
    }): Roll20Object[];
    function locsFindObjs(properties: {
      [property: string]: any;
    }): Roll20Object[] {
      function isMatch(obj: Roll20Object) {
        for (const [property, value] of Object.entries(properties)) {
          if (obj.get(property) !== value) {
            return false;
          }
        }
        return true;
      }

      const cacheKey = keyFromSearchArgs(properties);
      const cacheResult = cache.finds.get(cacheKey);
      if (cacheResult) {
        return cacheResult;
      }

      const roll20Result = findObjs(properties);
      roll20Result.forEach((obj) => cacheObject(obj));

      const newCacheValue = roll20Result;
      cache.finds.set(cacheKey, newCacheValue);

      const eventsForThisSearch = new Map();
      cache.events.set(cacheKey, eventsForThisSearch);

      eventsForThisSearch.set(
        `add:${properties._type}`,
        (obj: Roll20Object) => {
          if (isMatch(obj)) {
            newCacheValue.push(obj);
          }
        }
      );

      eventsForThisSearch.set(
        `change:${properties._type}`,
        (obj: Roll20Object, oldObj: Roll20Object) => {
          const doesMatch = isMatch(obj);
          const didMatch = isMatch(oldObj);
          if (doesMatch) {
            if (!didMatch) {
              newCacheValue.push(obj);
            }
          } else {
            if (didMatch) {
              const foundObjectIndex = newCacheValue.indexOf(obj);
              if (foundObjectIndex !== -1) {
                newCacheValue.splice(foundObjectIndex, 1);
              }
            }
          }
        }
      );

      eventsForThisSearch.set(
        `destroy:${properties._type}`,
        (obj: Roll20Object) => {
          const foundObjectIndex = newCacheValue.indexOf(obj);
          if (foundObjectIndex !== -1) {
            newCacheValue.splice(foundObjectIndex, 1);
          }
        }
      );

      for (const [eventLabel, callback] of eventsForThisSearch.entries()) {
        watchEvent(eventLabel, callback);
      }

      return roll20Result;
    }

    // TODO WARNING this can fail if the callback references a changing variable
    // at least warn users of this
    function locsFilterObjs(
      callback: (obj: Roll20Object) => boolean
    ): Roll20Object[] {
      const cachedResults = cache.filters.get(callback);
      if (cachedResults) {
        return cachedResults;
      }

      const newCacheResults = filterObjs(callback);
      cache.filters.set(callback, newCacheResults);

      const allObjectTypes: ObjectType[] = [
        'graphic',
        'text',
        'path',
        'character',
        'ability',
        'attribute',
        'handout',
        'rollabletable',
        'tableitem',
        'macro',
        'campaign',
        'player',
        'page',
      ];

      allObjectTypes.forEach((objType) => {
        watchEvent(`add:${objType}`, (obj: Roll20Object) => {
          if (callback(obj)) {
            newCacheResults.push(obj);
          }
        });

        watchEvent(
          `change:${objType}`,
          (obj: Roll20Object, oldObj: Roll20Object) => {
            const doesMatch = callback(obj);
            const didMatch = callback(oldObj);
            if (doesMatch) {
              if (!didMatch) {
                newCacheResults.push(obj);
              }
            } else {
              if (didMatch) {
                const foundObjIndex = newCacheResults.indexOf(obj);
                if (foundObjIndex !== -1) {
                  newCacheResults.splice(foundObjIndex, 1);
                }
              }
            }
          }
        );

        watchEvent(`destroy:${objType}`, (obj: Roll20Object) => {
          if (callback(obj)) {
            const foundObjIndex = newCacheResults.indexOf(obj);
            if (foundObjIndex !== -1) {
              newCacheResults.splice(foundObjIndex, 1);
            }
          }
        });
      });

      return newCacheResults;
    }

    function locsGetAttrByName(
      character_id: string,
      attribute_name: string,
      value_type: 'current' | 'max' = 'current'
    ): string {
      const attrObj = locsGetAttrObjByName(character_id, attribute_name);
      if (!attrObj) {
        return '';
      }

      return attrObj.get(value_type);
    }

    // TODO RESEARCH does roll20 manage duplicate named attributes?
    function locsGetAttrObjByName(
      character_id: string,
      attribute_name: string
    ): Attribute | undefined {
      const searchArgs = {
        _type: 'attribute',
        _characterid: character_id,
        name: attribute_name,
      };
      const searchResults = locsFindObjs(searchArgs);
      if (searchResults.length > 0) {
        const foundAttribute = searchResults[0];
        cacheObject(foundAttribute);
        return foundAttribute as Attribute | undefined;
      }
    }

    function locsGetObj(type: 'text', id: string): Text | undefined;
    function locsGetObj(type: 'graphic', id: string): Graphic | undefined;
    function locsGetObj(type: 'character', id: string): Character | undefined;
    function locsGetObj(type: 'attribute', id: string): Attribute | undefined;
    function locsGetObj(type: 'ability', id: string): Ability | undefined;
    function locsGetObj(type: 'player', id: string): Player | undefined;
    function locsGetObj(type: 'macro', id: string): Macro | undefined;
    function locsGetObj(type: 'page', id: string): Page | undefined;
    function locsGetObj(
      type: ObjectType,
      id: Roll20Id
    ): Roll20Object | undefined;
    function locsGetObj(
      type: ObjectType,
      id: Roll20Id
    ): Roll20Object | undefined {
      const cacheResult = cache.objects.get(id);
      if (cacheResult) {
        return cacheResult;
      }

      const roll20Result = getObj(type, id);
      if (roll20Result) {
        cacheObject(roll20Result);
      }
      return roll20Result;
    }

    return {
      createObj: locsCreateObj,
      findObjs: locsFindObjs,
      filterObjs: locsFilterObjs,
      getAttrByName: locsGetAttrByName,
      getAttrObjByName: locsGetAttrObjByName,
      getObj: locsGetObj,
    };
  };

  return {
    new: () => getLocs(),
  };
})();
