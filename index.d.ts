/// <reference types="roll20" />
declare type EventType = 'add' | 'change' | 'destroy';
declare type Roll20Id = string;
declare type Roll20EventLabel = string;
declare type SearchKey = string;
declare interface ILocsFactory {
    new: () => ILocs;
}
interface IEventHandler {
    fire(...objs: Roll20Object[]): void;
    subscribe(callback: (obj: Roll20Object) => void): void;
    subscribeUntilFired(callback: (obj: Roll20Object) => void): void;
    unsubscribe(callback: (obj: Roll20Object) => void): void;
}
interface ICreateObj {
    <T extends ObjectType>(type: T, properties: ObjectCreationPropertiesMap[T]): ObjectTypeMap[T] | undefined;
}
interface IFindObjs {
    <T extends ObjectType>(properties: Partial<ObjectPropertyMap[T]>): ObjectTypeMap[T][];
    (properties: {
        [property: string]: any;
    }): Roll20Object[];
}
interface IFilterObjs {
    (callback: (obj: Roll20Object) => boolean): Roll20Object[];
}
interface IGetAttrByName {
    (character_id: Roll20Id, attribute_name: string, value_type?: 'current' | 'max'): string;
}
interface IGetAttrObjByName {
    (character_id: Roll20Id, attribute_name: string): Attribute | undefined;
}
interface IGetObj {
    <T extends ObjectType>(type: T, id: string): ObjectTypeMap[T] | undefined;
}
declare interface ILocs {
    createObj: ICreateObj;
    findObjs: IFindObjs;
    filterObjs: IFilterObjs;
    getAttrByName: IGetAttrByName;
    getAttrObjByName: IGetAttrObjByName;
    getObj: IGetObj;
}
declare const Locs: ILocsFactory;
