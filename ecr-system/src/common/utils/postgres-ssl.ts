/**
 * Derives TypeORM/pg SSL options from DATABASE_URL without weakening certificate
 * verification when sslmode=require/verify-ca/verify-full is specified.
 */
export function buildPostgresSslConfig(
  databaseUrl?: string,
  explicitRejectUnauthorized?: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean | { rejectUnauthorized: boolean } | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  const isProduction = nodeEnv === 'production';

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    if (explicitRejectUnauthorized === 'false') {
      if (isProduction) {
        throw new Error(
          '[DATABASE_SSL_ERROR] DB_SSL_REJECT_UNAUTHORIZED=false is forbidden in production when no explicit secure sslmode is configured.',
        );
      }
      return { rejectUnauthorized: false };
    }
    return { rejectUnauthorized: true };
  }

  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
  const sslParam = parsed.searchParams.get('ssl')?.toLowerCase();

  if (sslMode === 'disable' || sslParam === '0' || sslParam === 'false') {
    if (isProduction) {
      throw new Error(
        '[DATABASE_SSL_ERROR] Insecure PostgreSQL TLS configuration (sslmode=disable / ssl=false) is forbidden in production.',
      );
    }
    return false;
  }

  if (sslMode === 'no-verify' || sslMode === 'allow') {
    if (isProduction) {
      throw new Error(
        `[DATABASE_SSL_ERROR] Insecure PostgreSQL TLS configuration (sslmode=${sslMode}) is forbidden in production.`,
      );
    }
    return undefined;
  }

  // Defer to pg-connection-string when sslmode is explicitly present in DATABASE_URL
  // so { rejectUnauthorized: false } never silently masks or conflicts with sslmode.
  if (sslMode) {
    return undefined;
  }

  if (explicitRejectUnauthorized === 'false') {
    if (isProduction) {
      throw new Error(
        '[DATABASE_SSL_ERROR] DB_SSL_REJECT_UNAUTHORIZED=false is forbidden in production when no explicit secure sslmode is configured.',
      );
    }
    return { rejectUnauthorized: false };
  }

  const host = parsed.hostname.toLowerCase();
  if (!isProduction && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
    return false;
  }

  return { rejectUnauthorized: true };
}
