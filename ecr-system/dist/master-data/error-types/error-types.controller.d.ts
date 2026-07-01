import { Repository } from 'typeorm';
import { ErrorType } from './error-type.entity';
export declare class ErrorTypesController {
    private repo;
    constructor(repo: Repository<ErrorType>);
    findAll(): Promise<ErrorType[]>;
    create(body: {
        name: string;
        description?: string;
    }): Promise<ErrorType>;
    update(id: string, body: Partial<ErrorType>): Promise<{
        id: string;
        name?: string | undefined;
        description?: string | undefined;
        isActive?: boolean | undefined;
    } & ErrorType>;
    deactivate(id: string): Promise<import("typeorm").UpdateResult>;
}
