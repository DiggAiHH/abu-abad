import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from '../config/database';

// Load .env from project root (not backend folder)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../..');
dotenv.config({ path: path.join(rootDir, '.env') });

/**
 * Validates required environment variables before migration
 * Why: Prevents partial migrations due to missing config
 */
function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✓ Environment variables validated');
}

/**
 * Tests database connection before executing schema
 * Why: Fail fast instead of wasting time on connection errors
 */
async function testConnection(): Promise<void> {
  try {
    const result = await pool.query('SELECT NOW() as time');
    console.log(`✓ Database connection established (${result.rows[0].time})`);
  } catch (error) {
    throw new Error(`❌ Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Executes schema within a transaction for atomicity
 * Why: Either all tables are created or none (ACID compliance)
 */
async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('\n🚀 Starting database migration...\n');
    
    // Step 1: Validate environment
    validateEnvironment();
    
    // Step 2: Test connection
    await testConnection();
    
    // Step 3: Load schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`❌ Schema file not found: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log(`✓ Schema loaded (${schema.length} bytes)`);
    
    // Step 4: Execute within transaction
    console.log('\n📊 Executing schema...');
    await client.query('BEGIN');
    
    try {
      await client.query(schema);
      await client.query('COMMIT');
      console.log('✓ Schema executed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`❌ Schema execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Step 5: Verify tables created
    const tableCount = await client.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log(`✓ Created ${tableCount.rows[0].count} tables`);
    
    console.log('\n✅ Migration completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check DATABASE_URL in .env');
    console.error('   2. Verify PostgreSQL is running: docker ps');
    console.error('   3. Check schema.sql syntax\n');
    process.exit(1);
  } finally {
    client.release();
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

migrate();
