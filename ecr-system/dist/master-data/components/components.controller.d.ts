import { Repository } from 'typeorm';
import { Component } from './component.entity';
export declare class ComponentsController {
    private repo;
    constructor(repo: Repository<Component>);
    findAll(): Promise<Component[]>;
    create(body: Partial<Component>): Promise<Component>;
    update(id: string, body: Partial<Component>): Promise<{
        id: string;
        code?: string | undefined;
        name?: string | undefined;
        stockQty?: number | undefined;
        unit?: string | undefined;
        isActive?: boolean | undefined;
    } & Component>;
    deactivate(id: string): Promise<import("typeorm").UpdateResult>;
}
