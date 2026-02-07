import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { DATABASE_URL } from '$env/static/private';

const { Pool } = pg;

// Strip sslmode from connection string to avoid conflict with explicit ssl option
const connectionString = DATABASE_URL?.replace(/[?&]sslmode=[^&]*/g, (match) => 
  match.startsWith('?') ? '?' : ''
).replace(/\?$/, '').replace(/\?&/, '?');

console.log('Database connection initializing...');
console.log('DATABASE_URL present:', !!DATABASE_URL);

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set!');
}

// Optimized connection pool for serverless
const pool = new Pool({
  connectionString,
  max: 3, // Allow concurrent queries during login + page load
  idleTimeoutMillis: 10000, // Close idle connections quickly
  connectionTimeoutMillis: 5000, // Fail fast on connection issues
  allowExitOnIdle: true, // Allow process to exit when idle
  ssl: { rejectUnauthorized: false } // Neon requires SSL
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export const db = drizzle(pool, { schema });
