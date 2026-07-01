export declare class IssuedComponentDto {
    componentId: string;
    componentName: string;
    qty: number;
}
export declare class CreateComponentIssueDto {
    reportId: string;
    components: IssuedComponentDto[];
    issuedToId: string;
    remarks?: string;
}
