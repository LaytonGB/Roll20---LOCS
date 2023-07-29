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
    cache: Map<string, Set<string>>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const TokenStateApi = (() => {
    class StateTracker {
        public cache: Map<string, Set<string>> = new Map();
    }

    return {
        createStateTracker: () => new StateTracker(),
    };
})();
