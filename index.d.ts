/// <reference types="roll20" />
declare type EventType = 'add' | 'change' | 'destroy';
declare type Roll20Id = string;
declare type Roll20EventLabel = string;
declare type SearchKey = string;
interface IEventHandler {
    fire(...objs: Roll20Object[]): void;
    subscribe(callback: (obj: Roll20Object) => void): void;
    subscribeUntilFired(callback: (obj: Roll20Object) => void): void;
    unsubscribe(callback: (obj: Roll20Object) => void): boolean;
}
interface ICreateObj {
    <T extends ObjectType>(type: T, properties: ObjectCreationPropertiesMap[T]): ObjectTypeMap[T] | undefined;
}
interface IFindObjs {
    <T extends ObjectType>(properties: {
        _type: T;
    } & Partial<ObjectPropertyMap[T]>): ObjectTypeMap[T][];
    (properties: {
        [property: string]: any;
    }): Roll20Object[];
}
interface IFilterObjs {
    <T extends ObjectType>(callback: (obj: Roll20Object) => boolean): ObjectTypeMap[T][];
    (callback: (obj: Roll20Object) => boolean): Roll20Object[];
}
interface IGetAttrByName {
    (character_id: Roll20Id, attribute_name: string, value_type?: 'current' | 'max'): string;
}
interface IGetAttrObjByName {
    (character_id: Roll20Id, attribute_name: string): Attribute | undefined;
}
interface IGetOrCreateAttrObjByName {
    (character_id: Roll20Id, attribute_name: string, defaultValues?: {
        current?: string;
        max?: string;
    }): Attribute | undefined;
}
interface IGetObj {
    <T extends ObjectType>(type: T, id: string): ObjectTypeMap[T] | undefined;
}
interface IOn {
    <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(eventLabel: `add:${T}` | `add:${T}:${K}` | `destroy:${T}` | `destroy:${T}:${K}`, callback: (obj: ObjectTypeMap[T]) => void): void;
    <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(eventLabel: `change:${T}` | `change:${T}:${K}`, callback: (obj: ObjectTypeMap[T], oldObj: ObjectPropertyMap[T]) => void): void;
}
interface IOnOnce {
    <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(eventLabel: `add:${T}` | `add:${T}:${K}` | `destroy:${T}` | `destroy:${T}:${K}`, callback: (obj: ObjectTypeMap[T]) => void): void;
    <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(eventLabel: `change:${T}` | `change:${T}:${K}`, callback: (obj: ObjectTypeMap[T], oldObj: ObjectPropertyMap[T]) => void): void;
}
interface IRemoveOn {
    <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(eventLabel: `add:${T}` | `add:${T}:${K}` | `destroy:${T}` | `destroy:${T}:${K}`, callback: (obj: ObjectTypeMap[T]) => void): boolean;
    <T extends ObjectType, K extends keyof ObjectPropertyMap[T] & string>(eventLabel: `change:${T}` | `change:${T}:${K}`, callback: (obj: ObjectTypeMap[T], oldObj: ObjectPropertyMap[T]) => void): boolean;
}
declare interface ILocs {
    createObj: ICreateObj;
    findObjs: IFindObjs;
    filterObjs: IFilterObjs;
    getAttrByName: IGetAttrByName;
    getAttrObjByName: IGetAttrObjByName;
    getOrCreateAttrObjByName: IGetOrCreateAttrObjByName;
    getObj: IGetObj;
    on: IOn;
    onOnce: IOnOnce;
    removeOn: IRemoveOn;
}
declare const Locs: ILocs;
