// Test database connection
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:gdr3ZpGB*KLCCmxgnVRg2ZcH@localhost:5432/hackathon_db";

console.log('Testing connection to:', DATABASE_URL.replace(/:[^:@]*@/, ':***@'));

async function testConnection() {
  try {
    const sql = postgres(DATABASE_URL);
    
    // Test query
    const result = await sql`SELECT version(), current_database(), current_user`;
    
    console.log('\n✅ Connection successful!');
    console.log('\nDatabase Info:');
    console.log('- PostgreSQL Version:', result[0].version.split(' ')[0], result[0].version.split(' ')[1]);
    console.log('- Database Name:', result[0].current_database);
    console.log('- Connected User:', result[0].current_user);
    
    // Test table access
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('\nTables in database:');
    if (tables.length === 0) {
      console.log('- No tables found (database is empty - run migrations)');
    } else {
      tables.forEach(t => console.log('- ', t.table_name));
    }
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Possible fixes:');
      console.error('   - PostgreSQL is not running');
      console.error('   - Check if PostgreSQL is installed: brew services list');
      console.error('   - Start PostgreSQL: brew services start postgresql');
    } else if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Possible fixes:');
      console.error('   - Wrong password in DATABASE_URL');
      console.error('   - Reset password: ALTER USER postgres PASSWORD \'new_password\';');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.error('\n💡 Possible fixes:');
      console.error('   - Database doesn\'t exist');
      console.error('   - Create it: psql -U postgres -c "CREATE DATABASE hackathon_db;"');
    }
    
    process.exit(1);
  }
}

testConnection();












