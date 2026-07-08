import { AuthService } from './auth.service';
import { Response, Request } from 'express';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(body: {
        username: string;
        password: string;
    }, res: Response, req: Request): Promise<{
        id: string;
        username: string;
        role: string;
        accessToken: string;
    }>;
    getMe(req: Request & {
        user: any;
    }): Promise<{
        id: string;
        username: string;
        role: string;
    }>;
    logout(res: Response): {
        message: string;
    };
}
