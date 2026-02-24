import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { join } from 'path';

const dbPath = process.env.DB_PATH || (
  process.env.NODE_ENV === 'test'
    ? ':memory:'
    : process.env.VERCEL
      ? '/tmp/bodega.db'
      : join(process.cwd(), 'bodega.db')
);

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = sqlite;
export const drizzleDb = drizzle(sqlite, { schema });
