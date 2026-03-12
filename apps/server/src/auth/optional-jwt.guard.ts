import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT: attaches user to request if token valid, otherwise leaves user undefined.
 * Use for routes that support both authenticated and anonymous (e.g. spectator).
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_err: Error | null, user: TUser): TUser | undefined {
    return user ?? undefined;
  }
}
