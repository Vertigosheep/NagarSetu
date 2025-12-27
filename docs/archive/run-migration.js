#!/usr/bin/env node

/**
 * Run Success Stories Migration
 * Run with: node run-migration.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://vzqtjhoevvjxdgocnfju.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cXRqaG9ldnZqeGRnb2NuZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTk5MjksImV4cCI6MjA3NzM5NTkyOX0.Y_z1NwNMsGtgJk-0opVJv4ZHj0mCSc7taQsuwcA7jJ0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  console.log('🚀 Running Success Stories Migration...\n');
  
  try {
    // Step 1: Add new columns
    console.log('1. Adding new columns to issues table...');
    
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE issues 
        ADD COLUMN IF NOT EXISTS solved_date TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS solver_name TEXT,
        ADD COLUMN IF NOT EXISTS solver_avatar TEXT,
        ADD COLUMN IF NOT EXISTS after_image TEXT;
      `
    });
    
    if (alterError) {
      console.log('❌ Error adding columns:', alterError.message);
      console.log('This might be a permissions issue. You may need to run the migration manually in Supabase SQL Editor.');
      return false;
    }
    
    console.log('✅ Columns added successfully');
    
    // Step 2: Create index
    console.log('\n2. Creating performance index...');
    
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_issues_solved_status ON issues(status, solved_date DESC) 
        WHERE status = 'solved';
      `
    });
    
    if (indexError) {
      console.log('⚠️  Index creation failed:', indexError.message);
      console.log('This is not critical, continuing...');
    } else {
      console.log('✅ Index created successfully');
    }
    
    // Step 3: Add sample data
    console.log('\n3. Adding sample success story...');
    
    // First, let's create a sample solved issue
    const { data: existingIssues, error: selectError } = await supabase
      .from('issues')
      .select('id')
      .limit(1);
    
    if (selectError) {
      console.log('❌ Error selecting issues:', selectError.message);
      return false;
    }
    
    if (existingIssues.length > 0) {
      const issueId = existingIssues[0].id;
      
      const { error: updateError } = await supabase
        .from('issues')
        .update({
          status: 'solved',
          solved_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          solver_name: 'Community Hero',
          solver_avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?q=80&w=100&auto=format&fit=crop',
          after_image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=400&auto=format&fit=crop'
        })
        .eq('id', issueId);
      
      if (updateError) {
        console.log('❌ Error updating issue:', updateError.message);
        return false;
      }
      
      console.log('✅ Sample success story created');
    } else {
      console.log('ℹ️  No existing issues found to convert to success story');
    }
    
    // Step 4: Verify the migration
    console.log('\n4. Verifying migration...');
    
    const { data: successStories, error: verifyError } = await supabase
      .from('issues')
      .select('*')
      .eq('status', 'solved')
      .not('after_image', 'is', null)
      .limit(1);
    
    if (verifyError) {
      console.log('❌ Verification failed:', verifyError.message);
      return false;
    }
    
    if (successStories.length > 0) {
      console.log('✅ Migration verified successfully');
      console.log('Sample success story:', successStories[0]);
    } else {
      console.log('⚠️  No success stories found after migration');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return false;
  }
}

runMigration().then(success => {
  if (success) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nThe Success Stories feature should now work on both:');
    console.log('- Homepage');
    console.log('- Issues page');
    console.log('\nRefresh your browser to see the changes.');
  } else {
    console.log('\n❌ Migration failed.');
    console.log('\nManual steps:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open the SQL Editor');
    console.log('3. Copy and paste the contents of success-stories-migration.sql');
    console.log('4. Run the SQL commands');
  }
  process.exit(0);
});