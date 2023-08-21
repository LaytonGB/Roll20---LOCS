/* eslint-disable @typescript-eslint/ban-ts-comment */

export type EventType = 'add' | 'change' | 'destroy';
export type Roll20Id = string;
export type Roll20EventLabel = string;
export type SearchKey = string;

type Roll20ObjectTypeMap = {
  text: Text;
  graphic: Graphic;
  character: Character;
  attribute: Attribute;
  ability: Ability;
  player: Player;
  macro: Macro;
  page: Page;
};

export interface ILocsFactory {
  new: () => ILocs;
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
  class EventHandler {
    private subscribers: [(...objs: Roll20Object[]) => void, boolean][] = [];

    label: Roll20EventLabel;

    constructor(roll20EventLabel: Roll20EventLabel) {
      this.label = roll20EventLabel;

      // @ts-ignore Does not correctly identify `on` overloads
      on(roll20EventLabel, this.fire.bind(this));
    }

    fire(...objs: Roll20Object[]): void {
      const indexesToRemove: number[] = [];
      this.subscribers.forEach(
        ([subscriberCallback, removeAfterFiring], index) => {
          subscriberCallback(...objs);
          if (removeAfterFiring) {
            indexesToRemove.push(index);
          }
        }
      );

      for (const index of indexesToRemove) {
        this.subscribers.splice(index, 1);
      }
    }

    subscribe(callback: (obj: Roll20Object) => void): void {
      this.subscribers.push([callback, false]);
    }

    subscribeUntilFired(callback: (obj: Roll20Object) => void): void {
      this.subscribers.push([callback, true]);
    }

    unsubscribe(callback: (obj: Roll20Object) => void): void {
      const foundCallbackIndex = this.subscribers.findIndex(
        ([storedCallback]) => storedCallback === callback
      );
      if (foundCallbackIndex === -1) {
        log(
          'WARN: cannot unsubscribe a callback function that is not already subscribed'
        );
        return;
      }

      this.subscribers.splice(foundCallbackIndex, 1);
    }
  }

  const getLocs = (): ILocs => {
    const eventHandlers = new Map<Roll20EventLabel, EventHandler>();
    const cache = {
      objects: new Map<Roll20Id, Roll20Object>(),
      events: new Map<
        Roll20Id | SearchKey,
        Map<Roll20EventLabel, (...eventDetails: Roll20Object[]) => void>
      >(),
      finds: new Map<SearchKey, Roll20Object[]>(),
      filters: new Map<(obj: Roll20Object) => boolean, Roll20Object[]>(),
    };

    const cacheObject = (obj: Roll20Object): void => {
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
    };

    const getOrCreateEvent = (eventLabel: Roll20EventLabel): EventHandler => {
      let event = eventHandlers.get(eventLabel);
      if (!event) {
        event = new EventHandler(eventLabel);
        eventHandlers.set(eventLabel, event);
      }
      return event;
    };

    const castRoll20ObjectToType = <T extends keyof Roll20ObjectTypeMap>(
      type: ObjectType,
      object: Roll20Object | undefined
    ): (Roll20ObjectTypeMap[T] | Roll20Object) | undefined => {
      switch (type) {
        case 'text':
          return object as Roll20ObjectTypeMap['text'] | undefined;
        case 'graphic':
          return object as Roll20ObjectTypeMap['graphic'] | undefined;
        case 'character':
          return object as Roll20ObjectTypeMap['character'] | undefined;
        case 'attribute':
          return object as Roll20ObjectTypeMap['attribute'] | undefined;
        case 'ability':
          return object as Roll20ObjectTypeMap['ability'] | undefined;
        case 'player':
          return object as Roll20ObjectTypeMap['player'] | undefined;
        case 'macro':
          return object as Roll20ObjectTypeMap['macro'] | undefined;
        case 'page':
          return object as Roll20ObjectTypeMap['page'] | undefined;
        default:
          return object as Roll20Object | undefined;
      }
    };

    const keyFromSearchArgs = (parameters: {
      [parameter: string]: any;
    }): string => {
      return Object.entries(parameters)
        .sort()
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    };

    const watchEvent = (
      eventLabel: Roll20EventLabel,
      callback: (...objs: Roll20Object[]) => void
    ): void => {
      const event = getOrCreateEvent(eventLabel);
      event.subscribe(callback);
    };

    const watchEventOnce = (
      eventLabel: Roll20EventLabel,
      callback: (obj: Roll20Object) => void
    ): void => {
      const event = getOrCreateEvent(eventLabel);
      event.subscribeUntilFired(callback);
    };

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
      return castRoll20ObjectToType(type, roll20Result);
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
