/* eslint-disable @typescript-eslint/ban-ts-comment */

type Roll20Id = string;
export type Roll20EventLabel = string;

export interface IStateTrackerFactory {
  createStateTracker: () => IStateTracker;
}

// this matches the property and method signatures of the StateTracker class
export interface IStateTracker {
  cache: Map<Roll20Id, Roll20Object>;
  trackedEvents: Map<string, Map<string, (eventDetails: any) => void>>;
  trackedSearches: Map<string, Roll20Object[]>;

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

  removeTrackedSearch: (properties: { [property: string]: any }) => void;
}

// TODO add methods for all cache interactions (eg, removeSearchCache, removeObjCache, etc)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const TokenStateApi: IStateTrackerFactory = (() => {
  class Roll20EventEmitter {
    private subscribers: [(obj: Roll20Object) => void, boolean][] = [];

    label: Roll20EventLabel;

    constructor(roll20EventLabel: Roll20EventLabel) {
      this.label = roll20EventLabel;

      // @ts-ignore Does not correctly identify `on` overloads
      on(roll20EventLabel, this.fire.bind(this));
    }

    fire(obj: Roll20Object): void {
      const indexesToRemove: number[] = [];
      this.subscribers.forEach(
        ([subscriberCallback, removeAfterFiring], index) => {
          subscriberCallback(obj);
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

  // TODO add createObj that instantly caches obj
  class StateTracker implements IStateTracker {
    private eventHandlers = new Map<Roll20EventLabel, Roll20EventEmitter>();

    cache = new Map<Roll20Id, Roll20Object>();
    trackedEvents = new Map<
      string,
      Map<Roll20EventLabel, (eventDetails: any) => void>
    >();
    trackedSearches = new Map<string, Roll20Object[]>();
    trackedFilters = new Map<(obj: Roll20Object) => boolean, Roll20Object[]>();

    findObjs(properties: { [property: string]: any }): Roll20Object[] {
      function addResultIfMatches(obj: Roll20Object) {
        for (const [property, value] of Object.entries(properties)) {
          if (obj.get(property) !== value) {
            return;
          }
        }
        newCacheValue.push(obj);
      }

      function removeResultIfNotMatches(
        obj: Roll20Object,
        foundObjectIndex: number
      ) {
        for (const [property, value] of Object.entries(properties)) {
          if (obj.get(property) !== value) {
            newCacheValue.splice(foundObjectIndex, 1);
            return;
          }
        }
      }

      const cacheKey = this.keyFromSearchArgs(properties);
      const cacheResult = this.trackedSearches.get(cacheKey);
      if (cacheResult) {
        return cacheResult;
      }

      const roll20Result = findObjs(properties);
      roll20Result.forEach((obj) => this.cacheObject(obj));

      const newCacheValue = roll20Result;
      this.trackedSearches.set(cacheKey, newCacheValue);

      let eventsForThisSearch = this.trackedEvents.get(cacheKey);
      // TODO is this needed?
      eventsForThisSearch = new Map();
      this.trackedEvents.set(cacheKey, eventsForThisSearch);

      // TODO tidy these events
      eventsForThisSearch.set(`add:${properties._type}`, addResultIfMatches);

      eventsForThisSearch.set(
        `change:${properties._type}`,
        (obj: Roll20Object) => {
          const foundObjectIndex = newCacheValue.indexOf(obj);
          if (foundObjectIndex === -1) {
            addResultIfMatches(obj);
          } else {
            removeResultIfNotMatches(obj, foundObjectIndex);
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
      const cachedResults = this.trackedFilters.get(callback);
      if (cachedResults) {
        return cachedResults;
      }

      const newCacheResults = filterObjs(callback);
      this.trackedFilters.set(callback, newCacheResults);

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

      // TODO clean these somehow
      allObjectTypes.forEach((objType) => {
        this.watchEvent(`add:${objType}`, (obj: Roll20Object) => {
          if (callback(obj)) {
            newCacheResults.push(obj);
          }
        });

        this.watchEvent(`destroy:${objType}`, (obj: Roll20Object) => {
          if (callback(obj)) {
            const foundObjIndex = newCacheResults.indexOf(obj);
            if (foundObjIndex !== -1) {
              newCacheResults.splice(foundObjIndex, 1);
            }
          }
        });

        this.watchEvent(`change:${objType}`, (obj: Roll20Object) => {
          // TODO add a way for the system to get changed objects both pre and post change
          if (callback(obj)) {
            if (!newCacheResults.includes(obj)) {
              newCacheResults.push(obj);
            }
          } else {
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

    // TODO duplicate results? does roll20 manage this?
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
      const cacheResult = this.cache.get(id);
      if (cacheResult) {
        return cacheResult;
      }

      const roll20Result = getObj(type, id);
      if (roll20Result) {
        this.cacheObject(roll20Result);
      }
      return roll20Result;
    }

    // TODO add tests for this section
    removeTrackedSearch(properties: { [property: string]: any }): void {
      const searchKey = this.keyFromSearchArgs(properties);
      this.trackedSearches.delete(searchKey);

      const events = this.trackedEvents.get(searchKey);

      if (events) {
        for (const [eventLabel, callback] of events.entries()) {
          this.stopWatchingEvent(eventLabel, callback);
        }
      }

      this.trackedEvents.delete(searchKey);
    }

    private cacheObject(obj: Roll20Object): void {
      this.cache.set(obj.id, obj);
      if (!this.trackedEvents.has(obj.id)) {
        const events = new Map<Roll20EventLabel, (obj: Roll20Object) => void>();
        this.trackedEvents.set(obj.id, events);

        const destroyEventLabel = `destroy:${obj.get('_type')}`;
        const destroyCallback = () => {
          this.cache.delete(obj.id);
          this.trackedEvents.delete(obj.id);
          // TODO on destroy this callback should stop listening
        };
        events.set(destroyEventLabel, destroyCallback);
        this.watchEventOnce(destroyEventLabel, destroyCallback);
      }
    }

    private getOrCreateEvent(eventLabel: Roll20EventLabel): Roll20EventEmitter {
      let event = this.eventHandlers.get(eventLabel);
      if (!event) {
        event = new Roll20EventEmitter(eventLabel);
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

    private stopWatchingEvent(
      eventLabel: Roll20EventLabel,
      callback: (obj: Roll20Object) => void
    ): void {
      this.eventHandlers.get(eventLabel)?.unsubscribe(callback);
    }

    private watchEvent(
      eventLabel: Roll20EventLabel,
      callback: (obj: Roll20Object) => void
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
    createStateTracker: () => new StateTracker(),
  };
})();
