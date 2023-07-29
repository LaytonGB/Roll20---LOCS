type CharacterProperties =
    | keyof CharacterImmutableSynchronousGetProperties
    | keyof CharacterMutableSynchronousGetProperties;
type GraphicProperties =
    | keyof GraphicImmutableSynchronousGetProperties
    | keyof GraphicMutableSynchronousGetProperties;

export interface IStateTrackerFactory {
    createStateTracker: () => /* IStateTracker */ object;
}

// this matches the property and method signatures of the StateTracker class
export interface IStateTracker {
    cache: Map<string, Map<string, any>>;

    getObj: (type: ObjectType, id: string) => Roll20Object | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const TokenStateApi = (() => {
    class StateTracker {
        cache: IStateTracker['cache'] = new Map();

        getObj: IStateTracker['getObj'] = (type: ObjectType, id: string) => {
            return getObj(type, id);
        };
    }

    return {
        createStateTracker: () => new StateTracker(),
    };
})();
