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

export interface IStateTrackerObjectProps {
  trackedEvents: Map<Roll20EventLabel, (() => void)[]>;
  trackedProps: Map<string, any>;
}

export interface IStateTrackerObject extends Roll20Object {
  stateTracker: IStateTrackerObjectProps;
  getWithoutCaching: (property: string) => any;
}

// this matches the property and method signatures of the StateTracker class
export interface IStateTracker {
  blacklist: {
    details: Map<Roll20Id, Set<string>>;
    ids: Set<Roll20Id>;
    properties: Set<string>;
  };
  cache: Map<Roll20Id, IStateTrackerObjectProps>;
  trackedAttributesForCharacter: Map<Roll20Id, Map<string, Roll20Id>>;
  trackedEvents: Map<string, Map<string, (eventDetails: any) => void>>;
  trackedSearches: Map<string, [ObjectType, Roll20Id][]>;

  findObjs: (properties: { [property: string]: any }) => IStateTrackerObject[];

  getAttrByName: (
    character_id: Roll20Id,
    attribute_name: string,
    value_type?: 'current' | 'max'
  ) => string;

  getAttrObjByName: (
    character_id: Roll20Id,
    attribute_name: string
  ) => IStateTrackerObject | undefined;

  getObj: (type: ObjectType, id: Roll20Id) => IStateTrackerObject | undefined;

  removeTrackedSearch: (properties: { [property: string]: any }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const TokenStateApi = (() => {
  class StateTrackerObject implements IStateTrackerObject {
    private stateTrackerObject: IStateTracker;

    id: string;
    type: ObjectType;
    stateTracker: IStateTrackerObjectProps;

    constructor(
      type: ObjectType,
      id: Roll20Id,
      { trackedEvents, trackedProps }: IStateTrackerObjectProps,
      stateTrackerObject: IStateTracker
    ) {
      this.type = type;
      this.id = id;

      this.stateTracker = {
        trackedEvents,
        trackedProps,
      };

      this.stateTrackerObject = stateTrackerObject;
    }

    get(property: string): any {
      const cachedValue = this.stateTracker.trackedProps.get(property);
      if (cachedValue) {
        return cachedValue;
      }

      const thisObjectFromRoll20 = getObj(this.type, this.id);
      const fetchedProperty = thisObjectFromRoll20?.get(property);
      if (fetchedProperty) {
        if (this.propertyIsCachable(property)) {
          this.stateTracker.trackedProps.set(property, fetchedProperty);
        }

        return fetchedProperty;
      }
    }

    getWithoutCaching(property: string): any {
      const thisObjectFromRoll20 = getObj(this.type, this.id);
      const fetchedProperty = thisObjectFromRoll20?.get(property);
      return fetchedProperty;
    }

    remove(): void {
      getObj(this.type, this.id)?.remove();
    }

    set(property: string, newValue: any): void {
      getObj(this.type, this.id)?.set(property, newValue);
    }

    private propertyIsCachable(property: string): boolean {
      const blacklist = this.stateTrackerObject.blacklist;
      return !(
        blacklist.properties.has(property) ||
        blacklist.details.get(this.id)?.has(property)
      );
    }
  }

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

    blacklist = {
      details: new Map<Roll20Id, Set<string>>(),
      ids: new Set<Roll20Id>(),
      properties: new Set<string>(),
    };
    cache = new Map<Roll20Id, IStateTrackerObjectProps>();
    trackedAttributesForCharacter: Map<Roll20Id, Map<string, Roll20Id>> =
      new Map();
    trackedEvents = new Map<
      string,
      Map<Roll20EventLabel, (eventDetails: any) => void>
    >();
    trackedSearches = new Map<string, [ObjectType, Roll20Id][]>();

    findObjs(properties: { [property: string]: any }): IStateTrackerObject[] {
      return this.findObjsProcess(properties, true);
    }

    // TODO add check for cache item deletions
    // TODO add check for duplicate result creation
    // TODO add check for cache item rename
    getAttrObjByName(
      character_id: string,
      attribute_name: string,
      cacheAllAttributes = false
    ): IStateTrackerObject | undefined {
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
        return this.getObj('attribute', cachedAttribute);
      }

      if (cacheAllAttributes) {
        const searchArgs = { _type: 'attribute', _characterid: character_id };
        const cachedFindResults = this.findObjsNoNewCacheEntry(searchArgs);
        let targetAttribute;
        cachedFindResults.forEach((attr) => {
          const name = attr.get('name');
          cachedCharacterAttributes?.set(name, attr.id);
          if (name === attribute_name) {
            targetAttribute = attr;
          }
        });
        return targetAttribute;
      } else {
        const searchArgs = {
          _type: 'attribute',
          _characterid: character_id,
          name: attribute_name,
        };
        const cachedFindResults = this.findObjsNoNewCacheEntry(searchArgs);
        if (cachedFindResults.length > 0) {
          return cachedFindResults[0];
        }
      }
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
      const cachedFindResults = this.findObjsNoNewCacheEntry(searchArgs);
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

    getObj(type: ObjectType, id: Roll20Id): IStateTrackerObject | undefined {
      const cacheResult = this.cache.get(id);
      if (cacheResult) {
        return this.createTrackerObject(type, id, cacheResult);
      }

      const roll20Result = getObj(type, id);
      if (!roll20Result) {
        return;
      }

      if (!this.blacklist.ids.has(id)) {
        return this.createAndRecordTrackerObject(type, id);
      } else {
        return this.createTrackerObject(
          type,
          id,
          this.newEmptyTrackerObjectProps(type, id)
        );
      }
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

    private createAndRecordTrackerObject(
      type: ObjectType,
      id: Roll20Id
    ): IStateTrackerObject {
      const trackerProps = this.newEmptyTrackerObjectProps(type, id);

      this.cache.set(id, trackerProps);

      return this.createTrackerObject(type, id, trackerProps);
    }

    private createTrackerObject(
      type: ObjectType,
      id: Roll20Id,
      props: IStateTrackerObjectProps
    ): IStateTrackerObject {
      return new StateTrackerObject(type, id, props, this);
    }

    private findObjsNoNewCacheEntry(properties: {
      [property: string]: any;
    }): IStateTrackerObject[] {
      return this.findObjsProcess(properties, false);
    }

    // TODO cache filtered props immediately
    // TODO optional arg to immediately cache some object props
    private findObjsProcess(
      properties: {
        [property: string]: any;
      },
      doCacheResults: boolean
    ): IStateTrackerObject[] {
      const cacheKey = this.keyFromSearchArgs(properties);
      const cacheResult = this.trackedSearches.get(cacheKey);
      if (cacheResult) {
        return cacheResult
          .map(([type, id]) => this.getObj(type, id))
          .filter((obj) => obj) as IStateTrackerObject[];
      }

      const roll20Result = findObjs(properties);
      const newCacheValue: [ObjectType, Roll20Id][] = [];
      if (properties._type && doCacheResults) {
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
              if (property === '_type') {
                continue;
              }

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
              if (property === '_type') {
                continue;
              }

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
      }

      return roll20Result.map((roll20Obj) => {
        const type = roll20Obj.get('_type');
        const id = roll20Obj.id;
        const objectProps =
          this.cache.get(id) || this.newEmptyTrackerObjectProps(type, id);

        newCacheValue.push([type, id]);

        return this.createTrackerObject(type, id, objectProps);
      });
    }

    private keyFromSearchArgs(parameters: {
      [parameter: string]: any;
    }): string {
      return Object.entries(parameters)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    }

    private newEmptyTrackerObjectProps(
      type: ObjectType,
      id: Roll20Id
    ): IStateTrackerObjectProps {
      return {
        trackedEvents: new Map(),
        trackedProps: new Map([
          ['_type', type],
          ['_id', id],
        ]),
      };
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
