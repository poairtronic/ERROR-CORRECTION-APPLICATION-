import { buildPostgresSslConfig } from './postgres-ssl';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ConnectionParameters = require('pg/lib/connection-parameters');

describe('buildPostgresSslConfig', () => {
  it('disables SSL when sslmode=disable is set', () => {
    expect(buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=disable')).toBe(false);
  });

  it('disables SSL by default for localhost/127.0.0.1 connections', () => {
    expect(buildPostgresSslConfig('postgresql://postgres@127.0.0.1:5432/ecr_test')).toBe(false);
    expect(buildPostgresSslConfig('postgresql://postgres@localhost:5432/ecr_test')).toBe(false);
  });

  it('defers to pg-connection-string when sslmode query param is explicitly present (does not downgrade verify-full/require)', () => {
    const reqUrl = 'postgresql://user:pass@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const fullUrl = 'postgresql://user:pass@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full';
    expect(buildPostgresSslConfig(reqUrl)).toBeUndefined();
    expect(buildPostgresSslConfig(fullUrl)).toBeUndefined();

    const paramsFull = new ConnectionParameters({ connectionString: fullUrl, ssl: buildPostgresSslConfig(fullUrl) });
    expect(paramsFull.ssl).toEqual({});
  });

  it('enables verified TLS (rejectUnauthorized: true) by default for remote URLs without sslmode', () => {
    const remoteUrl = 'postgresql://user:pass@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb';
    const ssl = buildPostgresSslConfig(remoteUrl);
    expect(ssl).toEqual({ rejectUnauthorized: true });

    const params = new ConnectionParameters({ connectionString: remoteUrl, ssl });
    expect(params.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('respects explicit DB_SSL_REJECT_UNAUTHORIZED override in non-production', () => {
    expect(buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb', 'false', 'development')).toEqual({
      rejectUnauthorized: false,
    });
    expect(buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb', 'true', 'development')).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('rejects insecure TLS configurations when NODE_ENV=production', () => {
    expect(() =>
      buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=disable', undefined, 'production'),
    ).toThrow('[DATABASE_SSL_ERROR]');
    expect(() =>
      buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=no-verify', undefined, 'production'),
    ).toThrow('[DATABASE_SSL_ERROR]');
    expect(() =>
      buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=allow', undefined, 'production'),
    ).toThrow('[DATABASE_SSL_ERROR]');
    expect(() =>
      buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb', 'false', 'production'),
    ).toThrow('[DATABASE_SSL_ERROR]');
    expect(() =>
      buildPostgresSslConfig('postgresql://postgres@127.0.0.1:5432/ecr', 'false', 'production'),
    ).toThrow('[DATABASE_SSL_ERROR]');
  });

  it('allows verified TLS modes in NODE_ENV=production', () => {
    expect(
      buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=require', undefined, 'production'),
    ).toBeUndefined();
    expect(
      buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=verify-full', undefined, 'production'),
    ).toBeUndefined();
    expect(
      buildPostgresSslConfig('postgresql://user:pass@ep-cool.neon.tech/neondb', undefined, 'production'),
    ).toEqual({ rejectUnauthorized: true });
  });
});
