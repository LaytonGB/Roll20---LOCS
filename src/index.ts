/* eslint-disable @typescript-eslint/ban-ts-comment */

export type EventType = 'add' | 'change' | 'destroy';
export type Roll20Id = string;
export type Roll20EventLabel = string;
export type SearchKey = string;

export interface ILocsFactory {
  new: () => ILocs;
}

export interface ILocs {
  createObj: (
    type: ObjectType,
    properties: { [property: string]: any }
  ) => Roll20Object | undefined;

  findObjs: (properties: { [property: string]: any }) => Roll20Object[];

  filterObjs: (callback: (obj: Roll20Object) => boolean) => Roll20Object[];

  getAttrByName: (
    character_id: Roll20Id,
    attribute_name: string,
    value_type?: 'current' | 'max'
  ) => string;

  getAttrObjByName: (
    character_id: Roll20Id,
    attribute_name: string
  ) => Roll20Object | undefined;

  getObj: (type: ObjectType, id: Roll20Id) => Roll20Object | undefined;
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

  class Locs implements ILocs {
    private eventHandlers = new Map<Roll20EventLabel, EventHandler>();
    private cache = {
      objects: new Map<Roll20Id, Roll20Object>(),
      events: new Map<
        Roll20Id | SearchKey,
        Map<Roll20EventLabel, (...eventDetails: Roll20Object[]) => void>
      >(),
      finds: new Map<SearchKey, Roll20Object[]>(),
      filters: new Map<(obj: Roll20Object) => boolean, Roll20Object[]>(),
    };

    createObj(
      type: ObjectType,
      properties: { [property: string]: any }
    ): Roll20Object | undefined {
      // @ts-ignore not assignable error because of roll20 types
      const newObject = createObj(type, properties);
      if (newObject) {
        this.cacheObject(newObject);
        return newObject;
      }
    }

    findObjs(properties: { [property: string]: any }): Roll20Object[] {
      function isMatch(obj: Roll20Object) {
        for (const [property, value] of Object.entries(properties)) {
          if (obj.get(property) !== value) {
            return false;
          }
        }
        return true;
      }

      const cacheKey = this.keyFromSearchArgs(properties);
      const cacheResult = this.cache.finds.get(cacheKey);
      if (cacheResult) {
        return cacheResult;
      }

      const roll20Result = findObjs(properties);
      roll20Result.forEach((obj) => this.cacheObject(obj));

      const newCacheValue = roll20Result;
      this.cache.finds.set(cacheKey, newCacheValue);

      const eventsForThisSearch = new Map();
      this.cache.events.set(cacheKey, eventsForThisSearch);

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
        this.watchEvent(eventLabel, callback);
      }

      return roll20Result;
    }

    filterObjs(callback: (obj: Roll20Object) => boolean): Roll20Object[] {
      const cachedResults = this.cache.filters.get(callback);
      if (cachedResults) {
        return cachedResults;
      }

      const newCacheResults = filterObjs(callback);
      this.cache.filters.set(callback, newCacheResults);

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
        this.watchEvent(`add:${objType}`, (obj: Roll20Object) => {
          if (callback(obj)) {
            newCacheResults.push(obj);
          }
        });

        this.watchEvent(
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

        this.watchEvent(`destroy:${objType}`, (obj: Roll20Object) => {
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

    getAttrByName(
      character_id: string,
      attribute_name: string,
      value_type: 'current' | 'max' = 'current'
    ): string {
      const attrObj = this.getAttrObjByName(character_id, attribute_name);
      if (!attrObj) {
        return '';
      }

      return attrObj.get(value_type);
    }

    // TODO RESEARCH does roll20 manage duplicate named attributes?
    getAttrObjByName(
      character_id: string,
      attribute_name: string
    ): Roll20Object | undefined {
      const searchArgs = {
        _type: 'attribute',
        _characterid: character_id,
        name: attribute_name,
      };
      const searchResults = this.findObjs(searchArgs);
      if (searchResults.length > 0) {
        const foundAttribute = searchResults[0];
        this.cacheObject(foundAttribute);
        return foundAttribute;
      }
    }

    getObj(type: ObjectType, id: Roll20Id): Roll20Object | undefined {
      const cacheResult = this.cache.objects.get(id);
      if (cacheResult) {
        return cacheResult;
      }

      const roll20Result = getObj(type, id);
      if (roll20Result) {
        this.cacheObject(roll20Result);
      }
      return roll20Result;
    }

    private cacheObject(obj: Roll20Object): void {
      this.cache.objects.set(obj.id, obj);
      if (!this.cache.events.has(obj.id)) {
        const events = new Map<Roll20EventLabel, (obj: Roll20Object) => void>();
        this.cache.events.set(obj.id, events);

        const destroyEventLabel = `destroy:${obj.get('_type')}`;
        const destroyCallback = () => {
          this.cache.objects.delete(obj.id);
          this.cache.events.delete(obj.id);
        };
        events.set(destroyEventLabel, destroyCallback);
        this.watchEventOnce(destroyEventLabel, destroyCallback);
      }
    }

    private getOrCreateEvent(eventLabel: Roll20EventLabel): EventHandler {
      let event = this.eventHandlers.get(eventLabel);
      if (!event) {
        event = new EventHandler(eventLabel);
        this.eventHandlers.set(eventLabel, event);
      }
      return event;
    }

    private keyFromSearchArgs(parameters: {
      [parameter: string]: any;
    }): string {
      return Object.entries(parameters)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    }

    private watchEvent(
      eventLabel: Roll20EventLabel,
      callback: (...objs: Roll20Object[]) => void
    ): void {
      const event = this.getOrCreateEvent(eventLabel);
      event.subscribe(callback);
    }

    private watchEventOnce(
      eventLabel: Roll20EventLabel,
      callback: (obj: Roll20Object) => void
    ): void {
      const event = this.getOrCreateEvent(eventLabel);
      event.subscribeUntilFired(callback);
    }
  }

  return {
    new: () => new Locs(),
  };
})();
