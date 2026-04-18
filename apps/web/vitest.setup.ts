// Vitest setup: provide dummy env vars so imports that read process.env at
// module load (e.g. @repo/db's client, Supabase SSR) don't throw during tests.
// Real integration tests would use a test DB URL instead.

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.NODE_ENV ??= "test";
