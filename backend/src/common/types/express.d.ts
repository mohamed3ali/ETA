import { UserRole } from '../../modules/users/user.entity';

declare global {
  namespace Express {
    interface AuthUserPayload {
      sub: string;       // user id
      email: string;
      role: UserRole;
      companyId: string; // multi-tenant scope
    }

    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export {};
