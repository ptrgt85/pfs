import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

// Optimized connection pool for serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/filing_system',
  max: 1, // Limit connections per serverless instance
  idleTimeoutMillis: 10000, // Close idle connections quickly
  connectionTimeoutMillis: 5000, // Fail fast on connection issues
  allowExitOnIdle: true // Allow process to exit when idle
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export const db = drizzle(pool, { schema });
