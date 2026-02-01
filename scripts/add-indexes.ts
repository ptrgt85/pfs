import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function addIndexes() {
  const sql = readFileSync('drizzle/0012_add_performance_indexes.sql', 'utf-8');

  try {
    console.log('Applying performance indexes...');
    await pool.query(sql);
    console.log('✅ Indexes added successfully!');
  } catch (error) {
    console.error('Error adding indexes:', error);
  } finally {
    await pool.end();
  }
}

addIndexes();
