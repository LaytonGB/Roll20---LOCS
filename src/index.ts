type AttributeProperties =
    | keyof AttributeImmutableSynchronousGetProperties
    | keyof AttributeMutableSynchronousGetProperties;
type CharacterProperties =
    | keyof CharacterImmutableSynchronousGetProperties
    | keyof CharacterMutableSynchronousGetProperties;
type GraphicProperties =
    | keyof GraphicImmutableSynchronousGetProperties
    | keyof GraphicMutableSynchronousGetProperties;

export interface IStateTrackerFactory {
    createStateTracker: () => IStateTracker;
}

export interface IStateTracker {
    getAttributeIfExists: (id: string) => Attribute | null;
    getCharacterIfExists: (id: string) => Character | null;
    getGraphicIfExists: (id: string) => Graphic | null;
}

export interface StateTrackerConfig {
    trackedAttributes?: AttributeProperties[];
    trackedCharacterProperties?: CharacterProperties[];
    trackedGraphicProperties?: GraphicProperties[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TokenStateApi = (() => {
    class StateTracker {
        private cache = new Map<string, Roll20Object>();
        private trackedAttributes: AttributeProperties[];
        private trackedCharacterProperties: CharacterProperties[];
        private trackedGraphicProperties: GraphicProperties[];

        constructor({
            trackedAttributes,
            trackedCharacterProperties,
            trackedGraphicProperties,
        }: StateTrackerConfig) {
            this.trackedAttributes = trackedAttributes || [];
            this.trackedCharacterProperties = trackedCharacterProperties || [];
            this.trackedGraphicProperties = trackedGraphicProperties || [];

            // TODO init cache with all objects from game based on tracked props
        }

        public getAttributeIfExists(id: string): Attribute | null {
            const graphicFromCache = this.getIfExists("attribute", id);
            return graphicFromCache as Attribute | null;
        }

        public getCharacterIfExists(id: string): Character | null {
            const graphicFromCache = this.getIfExists("character", id);
            return graphicFromCache as Character | null;
        }

        public getGraphicIfExists(id: string): Graphic | null {
            const graphicFromCache = this.getIfExists("graphic", id);
            return graphicFromCache as Graphic | null;
        }

        private getIfExists(type: ObjectType, id: string): Roll20Object | null {
            const cacheId = this.getCacheId(type, id);
            const objectFromCache = this.getFromCacheIfExists(cacheId);
            if (objectFromCache) {
                return objectFromCache;
            }

            const objectFromApi = getObj(type, id);
            if (objectFromApi) {
                return objectFromApi;
            }

            return null;
        }

        private getFromCacheIfExists(cacheId: string): Roll20Object | null {
            return this.cache.get(cacheId) || null;
        }

        private getCacheId(type: ObjectType, id: string): string {
            return `${type}:${id}`;
        }
    }

    return {
        createStateTracker: (stateTrackerConfig: StateTrackerConfig) =>
            new StateTracker(stateTrackerConfig),
    };
})();
