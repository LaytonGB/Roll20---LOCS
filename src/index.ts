type CharacterProperties =
    | keyof CharacterImmutableSynchronousGetProperties
    | keyof CharacterMutableSynchronousGetProperties;
type GraphicProperties =
    | keyof GraphicImmutableSynchronousGetProperties
    | keyof GraphicMutableSynchronousGetProperties;

export interface IStateTrackerFactory {
    createStateTracker: () => /* IStateTracker */ object;
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
        details: Map<string, Set<string>>;
        ids: Set<string>;
        properties: Set<string>;
    };
    cache: Map<string, IStateTrackerObjectProps>;

    getObj: (type: ObjectType, id: string) => IStateTrackerObject | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const TokenStateApi = (() => {
    class StateTrackerObject implements IStateTrackerObject {
        id;
        type;
        stateTracker;

        constructor(
            type: ObjectType,
            id: string,
            { trackedEvents, trackedProps }: IStateTrackerObjectProps
        ) {
            this.type = type;
            this.id = id;

            this.stateTracker = {
                trackedEvents,
                trackedProps,
            };
        }

        get(property: string): any {
            const cachedValue = this.stateTracker.trackedProps.get(property);
            if (cachedValue) {
                return cachedValue;
            }

            const thisObjectFromRoll20 = getObj(this.type, this.id);
            const fetchedProperty = thisObjectFromRoll20?.get(property);
            if (fetchedProperty) {
                this.stateTracker.trackedProps.set(property, fetchedProperty);

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
    }

    class StateTracker implements IStateTracker {
        blacklist = {
            details: new Map<string, Set<string>>(),
            ids: new Set<string>(),
            properties: new Set<string>(),
        };
        cache: IStateTracker['cache'] = new Map();

        getObj(type: ObjectType, id: string) {
            const cacheResult = this.cache.get(id);
            if (cacheResult) {
                return this.createTrackerObjectFromCache(type, id, cacheResult);
            }

            const roll20Result = getObj(type, id);
            if (!roll20Result) {
                return;
            }

            return this.createAndRecordTrackerObject(type, id);
        }

        private createAndRecordTrackerObject(type: ObjectType, id: string) {
            const trackerDetails = {
                trackedEvents: new Map(),
                trackedProps: new Map([
                    ['type', type],
                    ['id', id],
                ]),
            };

            this.cache.set(id, trackerDetails);

            return new StateTrackerObject(type, id, trackerDetails);
        }

        private createTrackerObjectFromCache(
            type: ObjectType,
            id: string,
            props: IStateTrackerObjectProps
        ) {
            return new StateTrackerObject(type, id, props);
        }
    }

    return {
        createStateTracker: () => new StateTracker(),
    };
})();
