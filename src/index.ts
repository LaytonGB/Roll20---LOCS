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
  blacklist: Set<Roll20Id>;
  cache: Map<Roll20Id, Roll20Object>;
  trackedAttributesForCharacter: Map<Roll20Id, Map<string, Roll20Id>>;
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
    private subscribers: ((obj: Roll20Object) => void)[] = [];

    label: Roll20EventLabel;

    constructor(roll20EventLabel: Roll20EventLabel) {
      this.label = roll20EventLabel;

      // @ts-ignore Does not correctly identify `on` overloads
      on(roll20EventLabel, this.fire.bind(this));
    }

    fire(obj: Roll20Object): void {
      for (const subscriberCallback of this.subscribers) {
        subscriberCallback(obj);
      }
    }

    subscribe(callback: (obj: Roll20Object) => void): void {
      this.subscribers.push(callback);
    }

    unsubscribe(callback: (obj: Roll20Object) => void): void {
      const foundCallbackIndex = this.subscribers.indexOf(callback);
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

    blacklist = new Set<string>();
    cache = new Map<Roll20Id, Roll20Object>();
    trackedAttributesForCharacter: Map<Roll20Id, Map<string, Roll20Id>> =
      new Map();
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
      let cachedCharacterAttributes =
        this.trackedAttributesForCharacter.get(character_id);
      if (!cachedCharacterAttributes) {
        cachedCharacterAttributes = new Map();
        this.trackedAttributesForCharacter.set(
          character_id,
          cachedCharacterAttributes
        );
      }

      const cachedAttribute = cachedCharacterAttributes.get(attribute_name);
      if (cachedAttribute) {
        return this.getObj('attribute', cachedAttribute)?.get(value_type);
      }

      const searchArgs = { _type: 'attribute', _characterid: character_id };
      const cachedFindResults = this.findObjs(searchArgs);
      let targetAttribute = '';
      cachedFindResults.forEach((attr) => {
        const name = attr.get('name');
        cachedCharacterAttributes?.set(name, attr.id);
        if (name === attribute_name) {
          targetAttribute = attr.get('name') || '';
        }
      });
      return targetAttribute;
    }

    // TODO add event for cache item deletions
    // TODO add event for duplicate result creation?
    // TODO add event for cache item rename
    getAttrObjByName(
      character_id: string,
      attribute_name: string
    ): Roll20Object | undefined {
      let cachedCharacterAttributes =
        this.trackedAttributesForCharacter.get(character_id);
      if (!cachedCharacterAttributes) {
        cachedCharacterAttributes = new Map();
        this.trackedAttributesForCharacter.set(
          character_id,
          cachedCharacterAttributes
        );
      }

      const cachedAttributeId = cachedCharacterAttributes.get(attribute_name);
      if (cachedAttributeId) {
        return this.getObj('attribute', cachedAttributeId);
      }

      const searchArgs = {
        _type: 'attribute',
        _characterid: character_id,
        name: attribute_name,
      };
      const searchResults = this.findObjs(searchArgs);
      if (searchResults.length > 0) {
        const foundAttribute = searchResults[0];
        cachedCharacterAttributes.set(attribute_name, foundAttribute.id);
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
      if (!this.blacklist.has(obj.id)) {
        this.cache.set(obj.id, obj);
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
