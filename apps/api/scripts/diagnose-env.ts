import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

console.log('🔍 Environment Variable Diagnostic\n');

// Show current working directory
console.log('Current Directory:', process.cwd());
console.log('');

// Check for .env files
const possibleEnvPaths = [
  '.env',
  'apps/api/.env',
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];

console.log('Checking for .env files:');
possibleEnvPaths.forEach(envPath => {
  const exists = fs.existsSync(envPath);
  const resolved = path.resolve(envPath);
  console.log(`  ${exists ? '✓' : '✗'} ${envPath}`);
  console.log(`     Resolved: ${resolved}`);
  
  if (exists) {
    try {
      const content = fs.readFileSync(resolved, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      console.log(`     Lines: ${lines.length}`);
      lines.forEach(line => {
        const key = line.split('=')[0];
        const hasValue = line.split('=')[1]?.trim().length > 0;
        console.log(`       - ${key}: ${hasValue ? 'SET' : 'EMPTY'}`);
      });
    } catch (err) {
      console.log(`     Error reading: ${err.message}`);
    }
  }
  console.log('');
});

// Try loading from different paths
console.log('Attempting to load .env files:\n');

const testPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '../../.env'),
];

testPaths.forEach(testPath => {
  console.log(`Testing: ${testPath}`);
  
  if (fs.existsSync(testPath)) {
    console.log('  ✓ File exists');
    
    // Clear existing env vars for clean test
    delete process.env.EODHD_API_KEY;
    
    // Try to load
    const result = dotenv.config({ path: testPath });
    
    if (result.error) {
      console.log('  ✗ Error loading:', result.error.message);
    } else {
      console.log('  ✓ Loaded successfully');
      console.log('  EODHD_API_KEY:', process.env.EODHD_API_KEY ? 
        process.env.EODHD_API_KEY.substring(0, 10) + '...' : 'NOT SET');
    }
  } else {
    console.log('  ✗ File does not exist');
  }
  console.log('');
});

// Show final state
console.log('Final Environment Variables:');
console.log('  EODHD_API_KEY:', process.env.EODHD_API_KEY ? 
  process.env.EODHD_API_KEY.substring(0, 10) + '...' : 'NOT SET');
console.log('  DATABASE_URL:', process.env.DATABASE_URL || 'NOT SET');
console.log('  API_PORT:', process.env.API_PORT || 'NOT SET');
console.log('');

// Check __dirname location
console.log('Script Location Info:');
console.log('  __dirname:', __dirname);
console.log('  __filename:', __filename);
console.log('');

// Try reading the .env file directly and show its content
const directEnvPath = path.resolve(process.cwd(), 'apps/api/.env');
console.log(`Reading ${directEnvPath} directly:`);
if (fs.existsSync(directEnvPath)) {
  const content = fs.readFileSync(directEnvPath, 'utf-8');
  console.log('Raw content:');
  console.log('---START---');
  console.log(content);
  console.log('---END---');
  console.log('');
  
  // Parse it
  console.log('Parsed content:');
  content.split('\n').forEach((line, index) => {
    console.log(`  Line ${index + 1}: "${line}"`);
    if (line.includes('EODHD_API_KEY')) {
      const parts = line.split('=');
      console.log(`    Key: "${parts[0]}"`);
      console.log(`    Value: "${parts[1]}"`);
      console.log(`    Value length: ${parts[1]?.length || 0}`);
    }
  });
} else {
  console.log('  ✗ File not found');
}
