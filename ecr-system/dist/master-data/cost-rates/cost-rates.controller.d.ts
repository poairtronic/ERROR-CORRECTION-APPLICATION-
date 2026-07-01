import { Repository } from 'typeorm';
import { CostRate } from './cost-rate.entity';
export declare class CostRatesController {
    private repo;
    constructor(repo: Repository<CostRate>);
    findAll(): Promise<CostRate[]>;
    create(body: Partial<CostRate>): Promise<CostRate>;
    update(id: string, body: Partial<CostRate>): Promise<{
        id: string;
        stageName?: string | undefined;
        ratePerHour?: number | undefined;
        isActive?: boolean | undefined;
    } & CostRate>;
    deactivate(id: string): Promise<import("typeorm").UpdateResult>;
}
