// Cleanup script: Delete old session files after migration is verified
// ONLY run after verifying migration was successful
// Run: node server/cleanup-old-sessions.js

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const OLD_DIR = path.join(__dirname, '../data/sessions');

async function promptConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('⚠️  This will DELETE old session files. Have you verified the migration? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function cleanupOldSessions() {
  console.log('🗑️  Old Session Cleanup\n');
  
  // Safety check - make sure we're not deleting from a subfolder
  if (OLD_DIR.includes('/workshop') || OLD_DIR.includes('/faculty')) {
    console.error('❌ Safety check failed: Directory path looks wrong');
    process.exit(1);
  }
  
  try {
    // Read all files
    const files = await fs.readdir(OLD_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('ℹ No JSON files to clean up');
      return;
    }
    
    console.log(`📋 Found ${jsonFiles.length} JSON files in old directory\n`);
    
    // Prompt for confirmation
    const confirmed = await promptConfirmation();
    
    if (!confirmed) {
      console.log('❌ Cleanup cancelled');
      process.exit(0);
    }
    
    console.log('\n🗑️  Deleting old files...\n');
    
    let deleted = 0;
    
    for (const file of jsonFiles) {
      const filepath = path.join(OLD_DIR, file);
      
      try {
        await fs.unlink(filepath);
        console.log(`✓ Deleted: ${file}`);
        deleted++;
      } catch (error) {
        console.error(`✗ Error deleting ${file}:`, error.message);
      }
    }
    
    console.log(`\n✅ Cleanup complete! Deleted ${deleted} files.\n`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupOldSessions().then(() => {
  process.exit(0);
});
