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
    trackedSearches: Map<string, [ObjectType, string][]>;

    findObjs: (properties: {
        [property: string]: any;
    }) => IStateTrackerObject[];

    getObj: (type: ObjectType, id: string) => IStateTrackerObject | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const TokenStateApi = (() => {
    class StateTrackerObject implements IStateTrackerObject {
        private stateTrackerObject: IStateTracker;

        id;
        type;
        stateTracker;

        constructor(
            type: ObjectType,
            id: string,
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
                    this.stateTracker.trackedProps.set(
                        property,
                        fetchedProperty
                    );
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

    class StateTracker implements IStateTracker {
        blacklist = {
            details: new Map<string, Set<string>>(),
            ids: new Set<string>(),
            properties: new Set<string>(),
        };
        cache = new Map<string, IStateTrackerObjectProps>();
        trackedSearches = new Map<string, [ObjectType, string][]>();

        findObjs(properties: {
            [property: string]: any;
        }): IStateTrackerObject[] {
            const cacheKey = this.keyFromSearchArgs(properties);
            const cacheResult = this.trackedSearches.get(cacheKey);
            if (cacheResult) {
                return cacheResult
                    .map(([type, id]) => this.getObj(type, id))
                    .filter((obj) => obj) as IStateTrackerObject[];
            }

            const roll20Result = findObjs(properties);
            return roll20Result.map((roll20Obj) => {
                const type = roll20Obj.get('_type');
                const id = roll20Obj.id;
                const cacheResult = this.cache.get(id);
                return this.createTrackerObject(
                    type,
                    id,
                    cacheResult || this.newEmptyTrackerObjectProps(type, id)
                );
            });
        }

        getObj(type: ObjectType, id: string): IStateTrackerObject | undefined {
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
            id: string
        ): IStateTrackerObject {
            const trackerProps = this.newEmptyTrackerObjectProps(type, id);

            this.cache.set(id, trackerProps);

            return this.createTrackerObject(type, id, trackerProps);
        }

        private createTrackerObject(
            type: ObjectType,
            id: string,
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

        private newEmptyTrackerObjectProps(type: ObjectType, id: string) {
            return {
                trackedEvents: new Map(),
                trackedProps: new Map([
                    ['_type', type],
                    ['_id', id],
                ]),
            };
        }
    }

    return {
        createStateTracker: () => new StateTracker(),
    };
})();
