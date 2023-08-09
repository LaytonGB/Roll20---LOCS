/* eslint-disable @typescript-eslint/ban-ts-comment */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Locs = (() => {
    class EventHandler {
        constructor(roll20EventLabel) {
            this.subscribers = [];
            this.label = roll20EventLabel;
            // @ts-ignore Does not correctly identify `on` overloads
            on(roll20EventLabel, this.fire.bind(this));
        }
        fire(obj) {
            const indexesToRemove = [];
            this.subscribers.forEach(([subscriberCallback, removeAfterFiring], index) => {
                subscriberCallback(obj);
                if (removeAfterFiring) {
                    indexesToRemove.push(index);
                }
            });
            for (const index of indexesToRemove) {
                this.subscribers.splice(index, 1);
            }
        }
        subscribe(callback) {
            this.subscribers.push([callback, false]);
        }
        subscribeUntilFired(callback) {
            this.subscribers.push([callback, true]);
        }
        unsubscribe(callback) {
            const foundCallbackIndex = this.subscribers.findIndex(([storedCallback]) => storedCallback === callback);
            if (foundCallbackIndex === -1) {
                log('WARN: cannot unsubscribe a callback function that is not already subscribed');
                return;
            }
            this.subscribers.splice(foundCallbackIndex, 1);
        }
    }
    class Locs {
        constructor() {
            this.eventHandlers = new Map();
            this.cache = {
                objects: new Map(),
                events: new Map(),
                finds: new Map(),
                filters: new Map(),
            };
        }
        createObj(type, properties) {
            // @ts-ignore not assignable error because of roll20 types
            const newObject = createObj(type, properties);
            if (newObject) {
                this.cacheObject(newObject);
                return newObject;
            }
        }
        findObjs(properties) {
            function addResultIfMatches(obj) {
                for (const [property, value] of Object.entries(properties)) {
                    if (obj.get(property) !== value) {
                        return;
                    }
                }
                newCacheValue.push(obj);
            }
            function removeResultIfNotMatches(obj, foundObjectIndex) {
                for (const [property, value] of Object.entries(properties)) {
                    if (obj.get(property) !== value) {
                        newCacheValue.splice(foundObjectIndex, 1);
                        return;
                    }
                }
            }
            const cacheKey = this.keyFromSearchArgs(properties);
            const cacheResult = this.cache.finds.get(cacheKey);
            if (cacheResult) {
                return cacheResult;
            }
            const roll20Result = findObjs(properties);
            roll20Result.forEach((obj) => this.cacheObject(obj));
            const newCacheValue = roll20Result;
            this.cache.finds.set(cacheKey, newCacheValue);
            const eventsForThisSearch = new Map();
            this.cache.events.set(cacheKey, eventsForThisSearch);
            // TODO tidy these events
            eventsForThisSearch.set(`add:${properties._type}`, addResultIfMatches);
            eventsForThisSearch.set(`change:${properties._type}`, (obj) => {
                const foundObjectIndex = newCacheValue.indexOf(obj);
                if (foundObjectIndex === -1) {
                    addResultIfMatches(obj);
                }
                else {
                    removeResultIfNotMatches(obj, foundObjectIndex);
                }
            });
            eventsForThisSearch.set(`destroy:${properties._type}`, (obj) => {
                const foundObjectIndex = newCacheValue.indexOf(obj);
                if (foundObjectIndex !== -1) {
                    newCacheValue.splice(foundObjectIndex, 1);
                }
            });
            for (const [eventLabel, callback] of eventsForThisSearch.entries()) {
                this.watchEvent(eventLabel, callback);
            }
            return roll20Result;
        }
        filterObjs(callback) {
            const cachedResults = this.cache.filters.get(callback);
            if (cachedResults) {
                return cachedResults;
            }
            const newCacheResults = filterObjs(callback);
            this.cache.filters.set(callback, newCacheResults);
            // TODO store this somewhere better
            const allObjectTypes = [
                'graphic',
                'text',
                'path',
                'character',
                'ability',
                'attribute',
                'handout',
                'rollabletable',
                'tableitem',
                'macro',
                'campaign',
                'player',
                'page',
            ];
            // TODO clean these somehow
            allObjectTypes.forEach((objType) => {
                this.watchEvent(`add:${objType}`, (obj) => {
                    if (callback(obj)) {
                        newCacheResults.push(obj);
                    }
                });
                this.watchEvent(`destroy:${objType}`, (obj) => {
                    if (callback(obj)) {
                        const foundObjIndex = newCacheResults.indexOf(obj);
                        if (foundObjIndex !== -1) {
                            newCacheResults.splice(foundObjIndex, 1);
                        }
                    }
                });
                this.watchEvent(`change:${objType}`, (obj) => {
                    // TODO add a way for the system to get changed objects both pre and post change
                    if (callback(obj)) {
                        if (!newCacheResults.includes(obj)) {
                            newCacheResults.push(obj);
                        }
                    }
                    else {
                        const foundObjIndex = newCacheResults.indexOf(obj);
                        if (foundObjIndex !== -1) {
                            newCacheResults.splice(foundObjIndex, 1);
                        }
                    }
                });
            });
            return newCacheResults;
        }
        getAttrByName(character_id, attribute_name, value_type = 'current') {
            const attrObj = this.getAttrObjByName(character_id, attribute_name);
            if (!attrObj) {
                return '';
            }
            return attrObj.get(value_type);
        }
        // TODO duplicate results? does roll20 manage this?
        getAttrObjByName(character_id, attribute_name) {
            const searchArgs = {
                _type: 'attribute',
                _characterid: character_id,
                name: attribute_name,
            };
            const searchResults = this.findObjs(searchArgs);
            if (searchResults.length > 0) {
                const foundAttribute = searchResults[0];
                this.cacheObject(foundAttribute);
                return foundAttribute;
            }
        }
        getObj(type, id) {
            const cacheResult = this.cache.objects.get(id);
            if (cacheResult) {
                return cacheResult;
            }
            const roll20Result = getObj(type, id);
            if (roll20Result) {
                this.cacheObject(roll20Result);
            }
            return roll20Result;
        }
        cacheObject(obj) {
            this.cache.objects.set(obj.id, obj);
            if (!this.cache.events.has(obj.id)) {
                const events = new Map();
                this.cache.events.set(obj.id, events);
                const destroyEventLabel = `destroy:${obj.get('_type')}`;
                const destroyCallback = () => {
                    this.cache.objects.delete(obj.id);
                    this.cache.events.delete(obj.id);
                };
                events.set(destroyEventLabel, destroyCallback);
                this.watchEventOnce(destroyEventLabel, destroyCallback);
            }
        }
        getOrCreateEvent(eventLabel) {
            let event = this.eventHandlers.get(eventLabel);
            if (!event) {
                event = new EventHandler(eventLabel);
                this.eventHandlers.set(eventLabel, event);
            }
            return event;
        }
        keyFromSearchArgs(parameters) {
            return Object.entries(parameters)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
        }
        watchEvent(eventLabel, callback) {
            const event = this.getOrCreateEvent(eventLabel);
            event.subscribe(callback);
        }
        watchEventOnce(eventLabel, callback) {
            const event = this.getOrCreateEvent(eventLabel);
            event.subscribeUntilFired(callback);
        }
    }
    return {
        new: () => new Locs(),
    };
})();
