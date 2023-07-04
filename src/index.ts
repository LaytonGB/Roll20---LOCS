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
    trackedAttributes?: string[];
    trackedCharacterProperties?: CharacterProperties[];
    trackedGraphicProperties?: GraphicProperties[];
}

type StoredRoll20ObjectMap = NonNullable<unknown>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TokenStateApi = (() => {
    class StateTracker {
        private cache = new Map<string, StoredRoll20ObjectMap>();
        private trackedAttributes: string[];
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

            this.initCache();
        }

        private initCache(): void {
            const objects = filterObjs(
                (obj) =>
                    obj.get('type') === 'attribute' ||
                    obj.get('type') === 'character' ||
                    obj.get('type') === 'graphic'
            );

            // const trackedAttributesSet = new Set(this.trackedAttributes);
            // const characterIdToAttributesMap = new Map<string, string[]>();
            // for (const object of objects) {
            //     if (object.get('type') === 'attribute') {
            //         const attribute = object as Attribute;
            //         const attributeName = attribute.get('name');
            //         if (trackedAttributesSet.has(attributeName)) {
            //             const attributeId = attribute.id;
            //             const characterId = attribute.get('_characterid');
            //             if (
            //                 !characterIdToAttributesMap
            //                     .get(characterId)
            //                     ?.push(attributeId)
            //             ) {
            //                 characterIdToAttributesMap.set(characterId, [
            //                     attributeId,
            //                 ]);
            //             }
            //         }
            //     }
            // }

            for (const object of objects) {
                if (object.get('type') === 'character') {
                    this.addCharacterAndAttributePropertiesToCache(
                        object as Character
                    );
                } else if (object.get('type') === 'graphic') {
                    this.addGraphicPropertiesToCache(object as Graphic);
                }
            }
        }

        private addCharacterAndAttributePropertiesToCache(
            character: Character
        ) {
            this.addObjectPropertiesToCache(
                character as Roll20Object,
                this.trackedCharacterProperties
            );
        }

        private addGraphicPropertiesToCache(graphic: Graphic) {
            this.addObjectPropertiesToCache(
                graphic as Roll20Object,
                this.trackedGraphicProperties
            );
        }

        private addObjectPropertiesToCache(
            object: Roll20Object,
            properties: string[]
        ) {
            const propertyMap = new Map<string, string | number | boolean>();
            for (const propertyName of properties) {
                const propertyValue = object.get(propertyName);
                if (propertyValue !== undefined) {
                    propertyMap.set(propertyName, propertyValue);
                }
            }
            this.cache.set(object.id, propertyMap);
        }

        public getAttributeIfExists(id: string): Attribute | null {
            const attributeOrNull = this.getIfExists('attribute', id);
            return attributeOrNull as Attribute | null;
        }

        public getCharacterIfExists(id: string): Character | null {
            const characterOrNull = this.getIfExists('character', id);
            return characterOrNull as Character | null;
        }

        public getGraphicIfExists(id: string): Graphic | null {
            const graphicOrNull = this.getIfExists('graphic', id);
            return graphicOrNull as Graphic | null;
        }

        private getIfExists(
            type: ObjectType,
            id: string
        ): StoredRoll20ObjectMap | null {
            const objectFromCache = this.getFromCacheIfExists(id);
            if (objectFromCache) {
                return objectFromCache;
            }

            // GET DATA FROM API AND MAKE OUTPUT OBJECT
            // const objectFromApi = getObj(type, id);
            // if (objectFromApi) {
            //     const properties = this.getTrackedPropertiesFromObject(
            //         type,
            //         objectFromApi
            //     );
            //     this.cache.set(id);
            //     return objectFromApi;
            // }

            return null;
        }

        private getFromCacheIfExists(id: string): StoredRoll20ObjectMap | null {
            return this.cache.get(id) || null;
        }
    }

    return {
        createStateTracker: (stateTrackerConfig: StateTrackerConfig) =>
            new StateTracker(stateTrackerConfig),
    };
})();
