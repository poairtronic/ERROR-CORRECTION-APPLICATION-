import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { instanceToPlain } from 'class-transformer';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class DefectReportSerializerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const groups: string[] = [];
    if (user && (user.role === Role.SENIOR_MANAGER || user.role === Role.ADMIN)) {
      groups.push('gmToSm');
    }

    return next.handle().pipe(
      map(data => instanceToPlain(data, { groups })),
    );
  }
}
