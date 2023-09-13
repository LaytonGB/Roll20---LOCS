/* eslint-disable @typescript-eslint/ban-ts-comment */

export type EventType = 'add' | 'change' | 'destroy';
export type Roll20Id = string;
export type Roll20EventLabel = string;
export type SearchKey = string;

interface IEventHandler {
  fire(...objs: Roll20Object[]): void;
  subscribe(callback: (obj: Roll20Object) => void): void;
  subscribeUntilFired(callback: (obj: Roll20Object) => void): void;
  unsubscribe(callback: (obj: Roll20Object) => void): boolean;
}

interface ICreateObj {
  <T extends ObjectType>(type: T, properties: ObjectCreationPropertiesMap[T]): ObjectTypeMap[T] | undefined;
}

interface IFindObjs {
  <T extends ObjectType>(properties: { _type: T } & Partial<ObjectPropertyMap[T]>): ObjectTypeMap[T][];
  (properties: { [property: string]: any }): Roll20Object[];
}

interface IFilterObjs {
  <T extends ObjectType>(callback: (obj: Roll20Object) => boolean): ObjectTypeMap[T][];
  (callback: (obj: Roll20Object) => boolean): Roll20Object[];
}

interface IGetAttrByName {
  (character_id: Roll20Id, attribute_name: string, value_type?: 'current' | 'max'): string;
}

interface IGetAttrObjByName {
  (character_id: Roll20Id, attribute_name: string): Attribute | undefined;
}

interface IGetObj {
  <T extends ObjectType>(type: T, id: string): ObjectTypeMap[T] | undefined;
}

interface IOn {
  <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(
    eventLabel: `add:${T}` | `add:${T}:${K}` | `destroy:${T}` | `destroy:${T}:${K}`,
    callback: (obj: ObjectTypeMap[T]) => void
  ): void;
  <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(
    eventLabel: `change:${T}` | `change:${T}:${K}`,
    callback: (obj: ObjectTypeMap[T], oldObj: ObjectPropertyMap[T]) => void
  ): void;
}

interface IOnOnce {
  <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(
    eventLabel: `add:${T}` | `add:${T}:${K}` | `destroy:${T}` | `destroy:${T}:${K}`,
    callback: (obj: ObjectTypeMap[T]) => void
  ): void;
  <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(
    eventLabel: `change:${T}` | `change:${T}:${K}`,
    callback: (obj: ObjectTypeMap[T], oldObj: ObjectPropertyMap[T]) => void
  ): void;
}

interface IRemoveOn {
  <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(
    eventLabel: `add:${T}` | `add:${T}:${K}` | `destroy:${T}` | `destroy:${T}:${K}`,
    callback: (obj: ObjectTypeMap[T]) => void
  ): boolean;
  <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(
    eventLabel: `change:${T}` | `change:${T}:${K}`,
    callback: (obj: ObjectTypeMap[T], oldObj: ObjectPropertyMap[T]) => void
  ): boolean;
}

export interface ILocs {
  createObj: ICreateObj;
  findObjs: IFindObjs;
  filterObjs: IFilterObjs;
  getAttrByName: IGetAttrByName;
  getAttrObjByName: IGetAttrObjByName;
  getOrCreateAttrObjByName: IGetAttrObjByName; // intentional type repetition
  getObj: IGetObj;
  on: IOn;
  onOnce: IOnOnce;
  removeOn: IRemoveOn;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const Locs = ((): ILocs => {
  function createEventHandler(roll20EventLabel: Roll20EventLabel): IEventHandler {
    const subscribers: [(...objs: Roll20Object[]) => void, boolean][] = [];

    function fire(...objs: Roll20Object[]): void {
      const indexesToRemove: number[] = [];
      subscribers.forEach(([subscriberCallback, removeAfterFiring], index) => {
        subscriberCallback(...objs);
        if (removeAfterFiring) indexesToRemove.push(index);
      });

      for (const index of indexesToRemove) subscribers.splice(index, 1);
    }

    function subscribe(callback: (obj: Roll20Object) => void): void {
      subscribers.push([callback, false]);
    }

    function subscribeUntilFired(callback: (obj: Roll20Object) => void): void {
      subscribers.push([callback, true]);
    }

    function unsubscribe(callback: (obj: Roll20Object) => void): boolean {
      const foundCallbackIndex = subscribers.findIndex(([storedCallback]) => storedCallback === callback);
      if (foundCallbackIndex === -1) {
        log('WARN: cannot unsubscribe a callback function that is not already subscribed');
        return false;
      }

      subscribers.splice(foundCallbackIndex, 1);
      return true;
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

  const eventHandlers = new Map<Roll20EventLabel, IEventHandler>();
  const cache = {
    objects: new Map<Roll20Id, Roll20Object>(),
    events: new Map<Roll20Id | SearchKey, Map<Roll20EventLabel, (...eventDetails: Roll20Object[]) => void>>(),
    finds: new Map<SearchKey, Roll20Object[]>(),
    filters: new Map<(obj: Roll20Object) => boolean, Roll20Object[]>(),
  };

  function cacheObject(obj: Roll20Object): void {
    cache.objects.set(obj.id, obj);
    if (!cache.events.has(obj.id)) {
      const events = new Map<Roll20EventLabel, (obj: Roll20Object) => void>();
      cache.events.set(obj.id, events);

      const destroyEventLabel: `destroy:${ObjectType}` = `destroy:${obj.get('_type') as ObjectType}`;
      const destroyCallback = (): void => {
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
      event = createEventHandler(eventLabel);
      eventHandlers.set(eventLabel, event);
    }
    return event;
  }

  function keyFromSearchArgs(parameters: { [parameter: string]: any }): string {
    return Object.entries(parameters)
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  function roll20ObjectPropertiesAsObject<T extends Roll20Object>(obj: ObjectPropertyMap[T['_type']]): T {
    return {
      id: obj._id,
      get: (property: keyof ObjectPropertyMap[T['_type']]): any => obj[property],
    } as T;
  }

  function watchEvent(eventLabel: Roll20EventLabel, callback: (...objs: Roll20Object[]) => void): void {
    const event = getOrCreateEvent(eventLabel);
    event.subscribe(callback);
  }

  function watchEventOnce(eventLabel: Roll20EventLabel, callback: (...objs: Roll20Object[]) => void): void {
    const event = getOrCreateEvent(eventLabel);
    event.subscribeUntilFired(callback);
  }

  function stopWatchingEvent(eventLabel: Roll20EventLabel, callback: (...objs: Roll20Object[]) => void): boolean {
    const listener = eventHandlers.get(eventLabel);
    if (!listener) return false;

    return listener.unsubscribe(callback);
  }

  function locsCreateObj<T extends ObjectType>(
    type: T,
    properties: ObjectCreationPropertiesMap[T]
  ): ObjectTypeMap[T] | undefined {
    const newObject = createObj(type, properties);
    if (newObject) {
      cacheObject(newObject);
      return newObject;
    }
  }

  function locsFindObjs<T extends ObjectType>(properties: Partial<ObjectPropertyMap[T]>): ObjectTypeMap[T][] {
    function isMatch(obj: Roll20Object): boolean {
      for (const [property, value] of Object.entries(properties)) if (obj.get(property) !== value) return false;
      return true;
    }

    const cacheKey = keyFromSearchArgs(properties);
    const cacheResult = cache.finds.get(cacheKey);
    if (cacheResult) return cacheResult as ObjectTypeMap[T][];

    const roll20Result = findObjs(properties);
    roll20Result.forEach((obj) => cacheObject(obj));

    const newCacheValue = roll20Result;
    cache.finds.set(cacheKey, newCacheValue);

    const eventsForThisSearch = new Map();
    cache.events.set(cacheKey, eventsForThisSearch);

    const objType = properties._type as ObjectType;

    eventsForThisSearch.set(`add:${objType}`, (obj: Roll20Object) => {
      if (isMatch(obj)) newCacheValue.push(obj);
    });

    eventsForThisSearch.set(
      `change:${objType}`,
      (obj: ObjectTypeMap[typeof objType], oldObj: ObjectPropertyMap[typeof objType]) => {
        const doesMatch = isMatch(obj);
        const reconstructedOldObj = roll20ObjectPropertiesAsObject<typeof obj>(oldObj);
        const didMatch = isMatch(reconstructedOldObj);
        if (doesMatch) {
          if (!didMatch) newCacheValue.push(obj);
        } else {
          if (didMatch) {
            const foundObjectIndex = newCacheValue.indexOf(obj);
            if (foundObjectIndex !== -1) newCacheValue.splice(foundObjectIndex, 1);
          }
        }
      }
    );

    eventsForThisSearch.set(`destroy:${properties._type}`, (obj: Roll20Object) => {
      const foundObjectIndex = newCacheValue.indexOf(obj);
      if (foundObjectIndex !== -1) newCacheValue.splice(foundObjectIndex, 1);
    });

    for (const [eventLabel, callback] of eventsForThisSearch.entries()) watchEvent(eventLabel, callback);

    return roll20Result as ObjectTypeMap[T][];
  }

  // TODO WARNING this can fail if the callback references a changing variable
  // at least warn users of this
  function locsFilterObjs(callback: (obj: Roll20Object) => boolean): Roll20Object[] {
    const cachedResults = cache.filters.get(callback);
    if (cachedResults) return cachedResults;

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
        if (callback(obj)) newCacheResults.push(obj);
      });

      watchEvent(
        `change:${objType}`,
        (obj: ObjectTypeMap[typeof objType], oldObj: ObjectPropertyMap[typeof objType]) => {
          const doesMatch = callback(obj);
          const reconstructedOldObj = roll20ObjectPropertiesAsObject<typeof obj>(oldObj);
          const didMatch = callback(reconstructedOldObj);
          if (doesMatch) {
            if (!didMatch) newCacheResults.push(obj);
          } else {
            if (didMatch) {
              const foundObjIndex = newCacheResults.indexOf(obj);
              if (foundObjIndex !== -1) newCacheResults.splice(foundObjIndex, 1);
            }
          }
        }
      );

      watchEvent(`destroy:${objType}`, (obj: Roll20Object) => {
        if (callback(obj)) {
          const foundObjIndex = newCacheResults.indexOf(obj);
          if (foundObjIndex !== -1) newCacheResults.splice(foundObjIndex, 1);
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
    if (!attrObj) return '';

    return attrObj.get(value_type);
  }

  // TODO RESEARCH does roll20 manage duplicate named attributes?
  function locsGetAttrObjByName(character_id: string, attribute_name: string): Attribute | undefined {
    const searchArgs = {
      _type: 'attribute' as const,
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

  function locsGetOrCreateAttrObjByName(
    character_id: string,
    attribute_name: string,
    defaultValues?: { current?: string; max?: string }
  ): Attribute | undefined {
    const searchArgs = {
      _type: 'attribute' as const,
      _characterid: character_id,
      name: attribute_name,
    };
    const searchResults = locsFindObjs(searchArgs);
    if (searchResults.length > 0) {
      const foundAttribute = searchResults[0];
      cacheObject(foundAttribute);
      return foundAttribute as Attribute;
    }

    const createdAttribute = locsCreateObj('attribute', {
      _characterid: character_id,
      name: attribute_name,
      ...defaultValues,
    });
    return createdAttribute;
  }

  function locsGetObj<T extends ObjectType>(type: T, id: Roll20Id): ObjectTypeMap[T] | undefined {
    const cacheResult = cache.objects.get(id);
    if (cacheResult) return cacheResult as ObjectTypeMap[T];

    const roll20Result = getObj(type, id);
    if (roll20Result) cacheObject(roll20Result);

    return roll20Result as ObjectTypeMap[T];
  }

  return {
    createObj: locsCreateObj,
    findObjs: locsFindObjs,
    filterObjs: locsFilterObjs,
    getAttrByName: locsGetAttrByName,
    getAttrObjByName: locsGetAttrObjByName,
    getOrCreateAttrObjByName: locsGetOrCreateAttrObjByName,
    getObj: locsGetObj,
    on: watchEvent,
    onOnce: watchEventOnce,
    removeOn: stopWatchingEvent,
  };
})();
