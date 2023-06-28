type AttributeProperties =
    | keyof AttributeImmutableSynchronousGetProperties
    | keyof AttributeMutableSynchronousGetProperties;
type CharacterProperties =
    | keyof CharacterImmutableSynchronousGetProperties
    | keyof CharacterMutableSynchronousGetProperties;
type GraphicProperties =
    | keyof GraphicImmutableSynchronousGetProperties
    | keyof GraphicMutableSynchronousGetProperties;

interface TokenStateMethodsObject {}

interface StateTrackerConfig {
    trackedGraphicProperties?: GraphicProperties[];
    trackedCharacterProperties?: CharacterProperties[];
    trackedAttributes?: AttributeProperties[];
}

const TokenStateApi: TokenStateMethodsObject = (() => {
    class StateTracker {
        constructor({
            trackedGraphicProperties,
            trackedCharacterProperties,
            trackedAttributes,
        }: StateTrackerConfig) {}
    }

    return {
        createStateTracker: (stateTrackerConfig: StateTrackerConfig) =>
            new StateTracker(stateTrackerConfig),
    };
})();
