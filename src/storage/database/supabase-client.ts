import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import * as schema from './shared/schema';

let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
  dbUrl?: string;
}

function loadEnv(): void {
  if (envLoaded || (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)) {
    return;
  }

  try {
    try {
      require('dotenv').config();
      if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
        envLoaded = true;
        return;
      }
    } catch {
      // dotenv not available
    }

    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail
  }
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY is not set');
  }

  return { 
    url, 
    anonKey,
    dbUrl: process.env.COZE_SUPABASE_DB_URL,
  };
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Database connection singleton
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (_db) {
    return _db;
  }
  
  const credentials = getSupabaseCredentials();
  
  // Use the direct database URL if available, otherwise construct from Supabase URL
  let dbUrl = credentials.dbUrl;
  
  if (!dbUrl) {
    // Try to get from environment variables
    dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.COZE_SUPABASE_DB_URL;
    
    // If we have Supabase URL and DB password, construct the connection string
    const supabaseUrl = credentials.url;
    const dbPassword = process.env.COZE_SUPABASE_DB_PASSWORD;
    
    if (!dbUrl && supabaseUrl && dbPassword) {
      // Extract project reference from URL
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      dbUrl = `postgres://postgres.${projectRef}:${dbPassword}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    }
  }
  
  if (!dbUrl) {
    throw new Error('Database URL not configured. Please set DATABASE_URL or COZE_SUPABASE_DB_URL environment variable.');
  }
  
  _pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  
  _db = drizzle(_pool, { schema });
  return _db;
}

// Export db as a getter function to defer initialization
export const db = {
  get select() {
    return getDb().select.bind(getDb());
  },
  get insert() {
    return getDb().insert.bind(getDb());
  },
  get update() {
    return getDb().update.bind(getDb());
  },
  get delete() {
    return getDb().delete.bind(getDb());
  },
};

export { loadEnv, getSupabaseCredentials, getSupabaseClient, getDb };
