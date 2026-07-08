import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { LoginHistory } from '../users/login-history.entity';
import { Response } from 'express';
export declare class AuthService {
    private usersRepo;
    private loginHistoryRepo;
    private jwtService;
    constructor(usersRepo: Repository<User>, loginHistoryRepo: Repository<LoginHistory>, jwtService: JwtService);
    login(username: string, password: string, res: Response, ipAddress?: string, userAgent?: string): Promise<{
        id: string;
        username: string;
        role: string;
        accessToken: string;
    }>;
    getMe(userId: string): Promise<{
        id: string;
        username: string;
        role: string;
    }>;
    logout(res: Response): {
        message: string;
    };
}
