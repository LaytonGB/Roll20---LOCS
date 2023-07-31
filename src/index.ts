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
  trackedEvents: Map<string, (() => void)[]>;
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
  trackedEvents: Map<string, Map<string, (eventDetails: any) => void>>;
  trackedSearches: Map<string, [ObjectType, Roll20Id][]>;

  findObjs: (properties: { [property: string]: any }) => IStateTrackerObject[];

  getObj: (type: ObjectType, id: Roll20Id) => IStateTrackerObject | undefined;
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

    private propertyIsCachable(property: string): boolean {
      const blacklist = this.stateTrackerObject.blacklist;
      return !(
        blacklist.properties.has(property) ||
        blacklist.details.get(this.id)?.has(property)
      );
    }

    remove(): void {
      getObj(this.type, this.id)?.remove();
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

    unsubscribe(callback: () => void): void {
      const foundCallbackIndex = this.subscribers.indexOf(callback);
      if (!foundCallbackIndex) {
        log(
          'WARN: cannot unsubscribe a callback function that is not already subscribed'
        );
        return;
      }

      this.subscribers.splice(foundCallbackIndex, 1);
    }
  }

  class StateTracker implements IStateTracker {
    private events: Map<Roll20EventLabel, Roll20EventEmitter> =
      this.initEventHandlers();

    blacklist = {
      details: new Map<Roll20Id, Set<string>>(),
      ids: new Set<Roll20Id>(),
      properties: new Set<string>(),
    };
    cache = new Map<Roll20Id, IStateTrackerObjectProps>();
    trackedEvents = new Map<
      string,
      Map<Roll20EventLabel, (eventDetails: any) => void>
    >();
    trackedSearches = new Map<string, [ObjectType, Roll20Id][]>();

    findObjs(properties: { [property: string]: any }): IStateTrackerObject[] {
      const cacheKey = this.keyFromSearchArgs(properties);
      const cacheResult = this.trackedSearches.get(cacheKey);
      if (cacheResult) {
        return cacheResult
          .map(([type, id]) => this.getObj(type, id))
          .filter((obj) => obj) as IStateTrackerObject[];
      }

      const roll20Result = findObjs(properties);
      const newCacheValue: [ObjectType, Roll20Id][] = [];
      if (properties._type) {
        this.trackedSearches.set(cacheKey, newCacheValue);

        let eventsForThisSearch = this.trackedEvents.get(cacheKey);
        if (!eventsForThisSearch) {
          eventsForThisSearch = new Map();
          this.trackedEvents.set(cacheKey, eventsForThisSearch);
        }

        // TODO this is all possibly broke now, pretty sure
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
            if (!foundObjectIndex) {
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
            if (!foundObjectIndex) {
              return;
            }

            if (newCacheValue.length === 1) {
              // teardown all events and destroy map entries
            } else {
              newCacheValue.splice(foundObjectIndex, 1);
            }
          }
        );

        for (const [eventLabel, callback] of eventsForThisSearch.entries()) {
          this.events.get(eventLabel)?.subscribe(callback);
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
      const emitter = this.events.get(eventLabel);
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
