// Migration script: Move existing sessions to workshop subfolder
// Run once: node server/migrate-sessions.js

const fs = require('fs').promises;
const path = require('path');

const OLD_DIR = path.join(__dirname, '../data/sessions');
const NEW_WORKSHOP_DIR = path.join(__dirname, '../data/sessions/workshop');

async function migrateExistingSessions() {
  console.log('🔄 Starting session migration...\n');
  
  try {
    // Create workshop directory if it doesn't exist
    await fs.mkdir(NEW_WORKSHOP_DIR, { recursive: true });
    console.log('✓ Workshop directory ready');
    
    // Read all files in old directory
    const files = await fs.readdir(OLD_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('ℹ No JSON files to migrate');
      return;
    }
    
    console.log(`📋 Found ${jsonFiles.length} session files\n`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const file of jsonFiles) {
      const oldPath = path.join(OLD_DIR, file);
      const newPath = path.join(NEW_WORKSHOP_DIR, file);
      
      // Check if file already exists in workshop folder
      try {
        await fs.access(newPath);
        console.log(`⏭️  Skipped (already exists): ${file}`);
        skipped++;
        continue;
      } catch {
        // File doesn't exist in new location, proceed with migration
      }
      
      try {
        // Read the file to update survey_type if needed
        const content = await fs.readFile(oldPath, 'utf8');
        const data = JSON.parse(content);
        
        // Add survey_type if not present
        if (!data.survey_type) {
          data.survey_type = 'workshop';
          // Write updated data to new location
          await fs.writeFile(newPath, JSON.stringify(data, null, 2), 'utf8');
        } else {
          // Just copy the file
          await fs.copyFile(oldPath, newPath);
        }
        
        console.log(`✓ Migrated: ${file}`);
        migrated++;
      } catch (error) {
        console.error(`✗ Error migrating ${file}:`, error.message);
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${jsonFiles.length}`);
    
    if (migrated > 0) {
      console.log(`\n⚠️  Original files are still in ${OLD_DIR}`);
      console.log(`   After verifying migration, you can manually delete them or run:`);
      console.log(`   node server/cleanup-old-sessions.js`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateExistingSessions().then(() => {
  console.log('\n✅ Migration complete!\n');
  process.exit(0);
});
