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
}

// this matches the property and method signatures of the StateTracker class
export interface IStateTracker {
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

            trackedProps.set('type', type);
            trackedProps.set('id', id);

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

        remove(): void {
            getObj(this.type, this.id)?.remove();
        }
    }

    class StateTracker implements IStateTracker {
        cache: IStateTracker['cache'] = new Map();

        getObj(type: ObjectType, id: string) {
            const cacheResult = this.cache.get(id);
            if (cacheResult) {
                return cacheResult;
            }

            const roll20Result = getObj(type, id);
            if (!roll20Result) {
                return;
            }

            return this.createAndRecordTrackerObject(type, id);
        }

        private createAndRecordTrackerObject(type: ObjectType, id: string) {
            return new StateTrackerObject(
                type,
                id,
                this.cache.get(id) || {
                    trackedEvents: new Map(),
                    trackedProps: new Map(),
                }
            );
        }
    }

    return {
        createStateTracker: () => new StateTracker(),
    };
})();
