/* eslint-disable @typescript-eslint/ban-ts-comment */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Locs = (() => {
    function getEventHandler(roll20EventLabel) {
        const subscribers = [];
        function fire(...objs) {
            const indexesToRemove = [];
            subscribers.forEach(([subscriberCallback, removeAfterFiring], index) => {
                subscriberCallback(...objs);
                if (removeAfterFiring) {
                    indexesToRemove.push(index);
                }
            });
            for (const index of indexesToRemove) {
                subscribers.splice(index, 1);
            }
        }
        function subscribe(callback) {
            subscribers.push([callback, false]);
        }
        function subscribeUntilFired(callback) {
            subscribers.push([callback, true]);
        }
        function unsubscribe(callback) {
            const foundCallbackIndex = subscribers.findIndex(([storedCallback]) => storedCallback === callback);
            if (foundCallbackIndex === -1) {
                log('WARN: cannot unsubscribe a callback function that is not already subscribed');
                return;
            }
            subscribers.splice(foundCallbackIndex, 1);
        }
        // @ts-ignore Does not correctly identify `on` overloads
        on(roll20EventLabel, fire);
        return {
            fire,
            subscribe,
            subscribeUntilFired,
            unsubscribe,
        };
    }
    const getLocs = () => {
        const eventHandlers = new Map();
        const cache = {
            objects: new Map(),
            events: new Map(),
            finds: new Map(),
            filters: new Map(),
        };
        function cacheObject(obj) {
            cache.objects.set(obj.id, obj);
            if (!cache.events.has(obj.id)) {
                const events = new Map();
                cache.events.set(obj.id, events);
                const destroyEventLabel = `destroy:${obj.get('_type')}`;
                const destroyCallback = () => {
                    cache.objects.delete(obj.id);
                    cache.events.delete(obj.id);
                };
                events.set(destroyEventLabel, destroyCallback);
                watchEventOnce(destroyEventLabel, destroyCallback);
            }
        }
        function getOrCreateEvent(eventLabel) {
            let event = eventHandlers.get(eventLabel);
            if (!event) {
                event = getEventHandler(eventLabel);
                eventHandlers.set(eventLabel, event);
            }
            return event;
        }
        function keyFromSearchArgs(parameters) {
            return Object.entries(parameters)
                .sort()
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
        }
        function watchEvent(eventLabel, callback) {
            const event = getOrCreateEvent(eventLabel);
            event.subscribe(callback);
        }
        function watchEventOnce(eventLabel, callback) {
            const event = getOrCreateEvent(eventLabel);
            event.subscribeUntilFired(callback);
        }
        function locsCreateObj(type, properties) {
            // @ts-ignore not assignable error because of roll20 types
            const newObject = createObj(type, properties);
            if (newObject) {
                cacheObject(newObject);
                return newObject;
            }
        }
        function locsFindObjs(properties) {
            function isMatch(obj) {
                for (const [property, value] of Object.entries(properties)) {
                    if (obj.get(property) !== value) {
                        return false;
                    }
                }
                return true;
            }
            const cacheKey = keyFromSearchArgs(properties);
            const cacheResult = cache.finds.get(cacheKey);
            if (cacheResult) {
                return cacheResult;
            }
            const roll20Result = findObjs(properties);
            roll20Result.forEach((obj) => cacheObject(obj));
            const newCacheValue = roll20Result;
            cache.finds.set(cacheKey, newCacheValue);
            const eventsForThisSearch = new Map();
            cache.events.set(cacheKey, eventsForThisSearch);
            eventsForThisSearch.set(`add:${properties._type}`, (obj) => {
                if (isMatch(obj)) {
                    newCacheValue.push(obj);
                }
            });
            eventsForThisSearch.set(`change:${properties._type}`, (obj, oldObj) => {
                const doesMatch = isMatch(obj);
                const didMatch = isMatch(oldObj);
                if (doesMatch) {
                    if (!didMatch) {
                        newCacheValue.push(obj);
                    }
                }
                else {
                    if (didMatch) {
                        const foundObjectIndex = newCacheValue.indexOf(obj);
                        if (foundObjectIndex !== -1) {
                            newCacheValue.splice(foundObjectIndex, 1);
                        }
                    }
                }
            });
            eventsForThisSearch.set(`destroy:${properties._type}`, (obj) => {
                const foundObjectIndex = newCacheValue.indexOf(obj);
                if (foundObjectIndex !== -1) {
                    newCacheValue.splice(foundObjectIndex, 1);
                }
            });
            for (const [eventLabel, callback] of eventsForThisSearch.entries()) {
                watchEvent(eventLabel, callback);
            }
            return roll20Result;
        }
        // TODO WARNING this can fail if the callback references a changing variable
        // at least warn users of this
        function locsFilterObjs(callback) {
            const cachedResults = cache.filters.get(callback);
            if (cachedResults) {
                return cachedResults;
            }
            const newCacheResults = filterObjs(callback);
            cache.filters.set(callback, newCacheResults);
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
            allObjectTypes.forEach((objType) => {
                watchEvent(`add:${objType}`, (obj) => {
                    if (callback(obj)) {
                        newCacheResults.push(obj);
                    }
                });
                watchEvent(`change:${objType}`, (obj, oldObj) => {
                    const doesMatch = callback(obj);
                    const didMatch = callback(oldObj);
                    if (doesMatch) {
                        if (!didMatch) {
                            newCacheResults.push(obj);
                        }
                    }
                    else {
                        if (didMatch) {
                            const foundObjIndex = newCacheResults.indexOf(obj);
                            if (foundObjIndex !== -1) {
                                newCacheResults.splice(foundObjIndex, 1);
                            }
                        }
                    }
                });
                watchEvent(`destroy:${objType}`, (obj) => {
                    if (callback(obj)) {
                        const foundObjIndex = newCacheResults.indexOf(obj);
                        if (foundObjIndex !== -1) {
                            newCacheResults.splice(foundObjIndex, 1);
                        }
                    }
                });
            });
            return newCacheResults;
        }
        function locsGetAttrByName(character_id, attribute_name, value_type = 'current') {
            const attrObj = locsGetAttrObjByName(character_id, attribute_name);
            if (!attrObj) {
                return '';
            }
            return attrObj.get(value_type);
        }
        // TODO RESEARCH does roll20 manage duplicate named attributes?
        function locsGetAttrObjByName(character_id, attribute_name) {
            const searchArgs = {
                _type: 'attribute',
                _characterid: character_id,
                name: attribute_name,
            };
            const searchResults = locsFindObjs(searchArgs);
            if (searchResults.length > 0) {
                const foundAttribute = searchResults[0];
                cacheObject(foundAttribute);
                return foundAttribute;
            }
        }
        function locsGetObj(type, id) {
            const cacheResult = cache.objects.get(id);
            if (cacheResult) {
                return cacheResult;
            }
            const roll20Result = getObj(type, id);
            if (roll20Result) {
                cacheObject(roll20Result);
            }
            return roll20Result;
        }
        return {
            createObj: locsCreateObj,
            findObjs: locsFindObjs,
            filterObjs: locsFilterObjs,
            getAttrByName: locsGetAttrByName,
            getAttrObjByName: locsGetAttrObjByName,
            getObj: locsGetObj,
        };
    };
    return {
        new: () => getLocs(),
    };
})();
