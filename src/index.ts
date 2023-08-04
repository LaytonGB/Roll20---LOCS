/* eslint-disable @typescript-eslint/ban-ts-comment */

type Roll20Id = string;
export type Roll20EventLabel =
  | 'add:attribute'
  | 'add:character'
  | 'add:graphic'
  | 'change:attribute'
  | 'change:character'
  | 'change:graphic'
  | 'destroy:attribute'
  | 'destroy:character'
  | 'destroy:graphic';

export interface IStateTrackerFactory {
  createStateTracker: () => IStateTracker;
}

// this matches the property and method signatures of the StateTracker class
export interface IStateTracker {
  cache: Map<Roll20Id, Roll20Object>;
  trackedEvents: Map<string, Map<string, (eventDetails: any) => void>>;
  trackedSearches: Map<string, [ObjectType, Roll20Id][]>;

  findObjs: (properties: { [property: string]: any }) => Roll20Object[];

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
export const TokenStateApi = (() => {
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

  class StateTracker implements IStateTracker {
    private eventHandlers: Map<Roll20EventLabel, Roll20EventEmitter> =
      this.initEventHandlers();

    cache = new Map<Roll20Id, Roll20Object>();
    trackedEvents = new Map<
      string,
      Map<Roll20EventLabel, (eventDetails: any) => void>
    >();
    trackedSearches = new Map<string, [ObjectType, Roll20Id][]>();

    findObjs(properties: { [property: string]: any }): Roll20Object[] {
      const cacheKey = this.keyFromSearchArgs(properties);
      const cacheResult = this.trackedSearches.get(cacheKey);
      if (cacheResult) {
        return cacheResult
          .map(([type, id]) => this.getObj(type, id))
          .filter((obj) => obj) as Roll20Object[];
      }

      const roll20Result = findObjs(properties);
      roll20Result.forEach(this.cacheObject.bind(this));

      const newCacheValue = roll20Result.map((obj) => [
        properties._type,
        obj.id,
      ]) as [ObjectType, string][];
      this.trackedSearches.set(cacheKey, newCacheValue);

      let eventsForThisSearch = this.trackedEvents.get(cacheKey);
      if (!eventsForThisSearch) {
        eventsForThisSearch = new Map();
        this.trackedEvents.set(cacheKey, eventsForThisSearch);
      }

      // TODO tidy these events
      eventsForThisSearch.set(
        `add:${properties._type}` as Roll20EventLabel,
        (obj: Roll20Object) => {
          for (const [property, value] of Object.entries(properties)) {
            if (obj.get(property) !== value) {
              return;
            }
          }
          newCacheValue.push([obj.get('_type'), obj.id]);
        }
      );

      eventsForThisSearch.set(
        `change:${properties._type}` as Roll20EventLabel,
        (obj: Roll20Object) => {
          const foundObjectIndex = newCacheValue.findIndex(
            ([, id]) => id === obj.id
          );
          if (foundObjectIndex === -1) {
            return;
          }

          for (const [property, value] of Object.entries(properties)) {
            if (obj.get(property) !== value) {
              newCacheValue.splice(foundObjectIndex, 1);
              return;
            }
          }
        }
      );

      eventsForThisSearch.set(
        `destroy:${properties._type}` as Roll20EventLabel,
        (obj: Roll20Object) => {
          const foundObjectIndex = newCacheValue.findIndex(
            ([, id]) => id === obj.id
          );
          if (foundObjectIndex === -1) {
            return;
          }

          if (newCacheValue.length === 1) {
            this.trackedSearches.delete(cacheKey);
          } else {
            newCacheValue.splice(foundObjectIndex, 1);
          }
        }
      );

      for (const [eventLabel, callback] of eventsForThisSearch.entries()) {
        this.eventHandlers.get(eventLabel)?.subscribe(callback);
      }

      return roll20Result;
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

    removeTrackedSearch(properties: { [property: string]: any }): void {
      const searchKey = this.keyFromSearchArgs(properties);
      this.trackedSearches.delete(searchKey);

      const events = this.trackedEvents.get(searchKey);

      // TODO add tests for this section
      if (events) {
        for (const [eventLabel, callback] of events.entries()) {
          this.eventHandlers.get(eventLabel)?.unsubscribe(callback);
          this.eventHandlers.delete(eventLabel);
        }
      }

      this.trackedEvents.delete(searchKey);
    }

    private cacheObject(obj: Roll20Object): void {
      this.cache.set(obj.id, obj);
      if (!this.trackedEvents.has(obj.id)) {
        const events = new Map<Roll20EventLabel, (obj: Roll20Object) => void>();
        this.trackedEvents.set(obj.id, events);

        const destroyEventLabel = `destroy:${obj.get(
          '_type'
        )}` as Roll20EventLabel;
        const destroyCallback = () => {
          this.cache.delete(obj.id);
          this.trackedEvents.delete(obj.id);
        };
        events.set(destroyEventLabel, destroyCallback);
        this.eventHandlers
          .get(destroyEventLabel)
          ?.subscribeUntilFired(destroyCallback);
      }
    }

    private keyFromSearchArgs(parameters: {
      [parameter: string]: any;
    }): string {
      return Object.entries(parameters)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    }

    private initEventHandlers(): Map<Roll20EventLabel, Roll20EventEmitter> {
      const eventsToWatch: Roll20EventLabel[] = [
        'add:attribute',
        'add:character',
        'add:graphic',
        'change:attribute',
        'change:character',
        'change:graphic',
        'destroy:attribute',
        'destroy:character',
        'destroy:graphic',
      ];

      const events = new Map(
        eventsToWatch.map((eventLabel) => [
          eventLabel,
          new Roll20EventEmitter(eventLabel),
        ])
      );
      return events;
    }

    private watchEvent(
      eventLabel: Roll20EventLabel,
      callback: (obj: Roll20Object) => void
    ): void {
      const emitter = this.eventHandlers.get(eventLabel);
      if (!emitter) {
        log(
          'WARN: a subscription was attempted to an event that does not exist'
        );
        return;
      }

      emitter.subscribe(callback);
    }
  }

  return {
    createStateTracker: () => new StateTracker(),
  };
})();
