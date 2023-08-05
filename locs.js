/* eslint-disable @typescript-eslint/ban-ts-comment */
// TODO add methods for all cache interactions (eg, removeSearchCache, removeObjCache, etc)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TokenStateApi = (() => {
    class Roll20EventEmitter {
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
    class StateTracker {
        constructor() {
            this.eventHandlers = this.initEventHandlers();
            this.cache = new Map();
            this.trackedEvents = new Map();
            this.trackedSearches = new Map();
        }
        findObjs(properties) {
            const cacheKey = this.keyFromSearchArgs(properties);
            const cacheResult = this.trackedSearches.get(cacheKey);
            if (cacheResult) {
                return cacheResult
                    .map(([type, id]) => this.getObj(type, id))
                    .filter((obj) => obj);
            }
            const roll20Result = findObjs(properties);
            roll20Result.forEach(this.cacheObject.bind(this));
            const newCacheValue = roll20Result.map((obj) => [
                properties._type,
                obj.id,
            ]);
            this.trackedSearches.set(cacheKey, newCacheValue);
            let eventsForThisSearch = this.trackedEvents.get(cacheKey);
            if (!eventsForThisSearch) {
                eventsForThisSearch = new Map();
                this.trackedEvents.set(cacheKey, eventsForThisSearch);
            }
            // TODO tidy these events
            eventsForThisSearch.set(`add:${properties._type}`, (obj) => {
                for (const [property, value] of Object.entries(properties)) {
                    if (obj.get(property) !== value) {
                        return;
                    }
                }
                newCacheValue.push([obj.get('_type'), obj.id]);
            });
            eventsForThisSearch.set(`change:${properties._type}`, (obj) => {
                const foundObjectIndex = newCacheValue.findIndex(([, id]) => id === obj.id);
                if (foundObjectIndex === -1) {
                    return;
                }
                for (const [property, value] of Object.entries(properties)) {
                    if (obj.get(property) !== value) {
                        newCacheValue.splice(foundObjectIndex, 1);
                        return;
                    }
                }
            });
            eventsForThisSearch.set(`destroy:${properties._type}`, (obj) => {
                const foundObjectIndex = newCacheValue.findIndex(([, id]) => id === obj.id);
                if (foundObjectIndex === -1) {
                    return;
                }
                if (newCacheValue.length === 1) {
                    this.trackedSearches.delete(cacheKey);
                }
                else {
                    newCacheValue.splice(foundObjectIndex, 1);
                }
            });
            Object.entries(eventsForThisSearch).forEach(([eventLabel, callback]) => {
                this.watchEvent(eventLabel, callback);
            });
            return roll20Result;
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
            const cacheResult = this.cache.get(id);
            if (cacheResult) {
                return cacheResult;
            }
            const roll20Result = getObj(type, id);
            if (roll20Result) {
                this.cacheObject(roll20Result);
            }
            return roll20Result;
        }
        removeTrackedSearch(properties) {
            const searchKey = this.keyFromSearchArgs(properties);
            this.trackedSearches.delete(searchKey);
            const events = this.trackedEvents.get(searchKey);
            // TODO add tests for this section
            if (events) {
                Object.entries(events).forEach(([eventLabel, callback]) => {
                    this.stopWatchingEvent(eventLabel, callback);
                });
            }
            this.trackedEvents.delete(searchKey);
        }
        cacheObject(obj) {
            this.cache.set(obj.id, obj);
            if (!this.trackedEvents.has(obj.id)) {
                const events = new Map();
                this.trackedEvents.set(obj.id, events);
                const destroyEventLabel = `destroy:${obj.get('_type')}`;
                const destroyCallback = () => {
                    this.cache.delete(obj.id);
                    this.trackedEvents.delete(obj.id);
                    // TODO on destroy this callback should stop listening
                };
                events.set(destroyEventLabel, destroyCallback);
                this.watchEventOnce(destroyEventLabel, destroyCallback);
            }
        }
        getEventOrNull(eventLabel) {
            const event = this.eventHandlers.get(eventLabel);
            if (!event) {
                log('WARN: a subscription was attempted to an event that does not exist');
                return null;
            }
            return event;
        }
        keyFromSearchArgs(parameters) {
            return Object.entries(parameters)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
        }
        initEventHandlers() {
            const eventsToWatch = [
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
            const events = new Map(eventsToWatch.map((eventLabel) => [
                eventLabel,
                new Roll20EventEmitter(eventLabel),
            ]));
            return events;
        }
        stopWatchingEvent(eventLabel, callback) {
            var _a;
            (_a = this.eventHandlers.get(eventLabel)) === null || _a === void 0 ? void 0 : _a.unsubscribe(callback);
        }
        watchEvent(eventLabel, callback) {
            const event = this.getEventOrNull(eventLabel);
            if (event) {
                event.subscribe(callback);
            }
        }
        watchEventOnce(eventLabel, callback) {
            const event = this.getEventOrNull(eventLabel);
            if (event) {
                event.subscribeUntilFired(callback);
            }
        }
    }
    return {
        createStateTracker: () => new StateTracker(),
    };
})();
