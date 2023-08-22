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
    (type: 'attribute', properties: {
        [property: string]: any;
    }): Attribute | undefined;
    (type: 'graphic', properties: {
        [property: string]: any;
    }): Graphic | undefined;
}
interface IFindObjs {
    (properties: {
        _type: 'text';
    } & {
        [property: string]: any;
    }): Text[];
    (properties: {
        _type: 'graphic';
    } & {
        [property: string]: any;
    }): Graphic[];
    (properties: {
        _type: 'character';
    } & {
        [property: string]: any;
    }): Character[];
    (properties: {
        _type: 'attribute';
    } & {
        [property: string]: any;
    }): Attribute[];
    (properties: {
        _type: 'ability';
    } & {
        [property: string]: any;
    }): Ability[];
    (properties: {
        _type: 'player';
    } & {
        [property: string]: any;
    }): Player[];
    (properties: {
        _type: 'macro';
    } & {
        [property: string]: any;
    }): Macro[];
    (properties: {
        _type: 'page';
    } & {
        [property: string]: any;
    }): Page[];
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
    (type: 'text', id: string): Text | undefined;
    (type: 'graphic', id: string): Graphic | undefined;
    (type: 'character', id: string): Character | undefined;
    (type: 'attribute', id: string): Attribute | undefined;
    (type: 'ability', id: string): Ability | undefined;
    (type: 'player', id: string): Player | undefined;
    (type: 'macro', id: string): Macro | undefined;
    (type: 'page', id: string): Page | undefined;
    (type: ObjectType, id: string): Roll20Object | undefined;
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
