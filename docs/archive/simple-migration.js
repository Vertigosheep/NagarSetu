#!/usr/bin/env node

/**
 * Simple Success Stories Migration
 * Run with: node simple-migration.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzqtjhoevvjxdgocnfju.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cXRqaG9ldnZqeGRnb2NuZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTk5MjksImV4cCI6MjA3NzM5NTkyOX0.Y_z1NwNMsGtgJk-0opVJv4ZHj0mCSc7taQsuwcA7jJ0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createSampleSuccessStory() {
  console.log('🚀 Creating sample success story...\n');
  
  try {
    // Get an existing issue to convert
    console.log('1. Finding an existing issue to convert...');
    
    const { data: existingIssues, error: selectError } = await supabase
      .from('issues')
      .select('*')
      .limit(1);
    
    if (selectError) {
      console.log('❌ Error selecting issues:', selectError.message);
      return false;
    }
    
    if (existingIssues.length === 0) {
      console.log('❌ No existing issues found to convert');
      return false;
    }
    
    const issue = existingIssues[0];
    console.log('✅ Found issue to convert:', issue.title);
    
    // Try to update the issue with success story data
    console.log('\n2. Converting issue to success story...');
    
    const updateData = {
      status: 'solved',
      solver_name: 'Community Hero',
      solver_avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?q=80&w=100&auto=format&fit=crop',
      after_image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=400&auto=format&fit=crop'
    };
    
    // Check if the columns exist by trying to update
    const { data: updatedIssue, error: updateError } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', issue.id)
      .select()
      .single();
    
    if (updateError) {
      console.log('❌ Update failed:', updateError.message);
      
      if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
        console.log('\n🔧 The database columns are missing. You need to run the migration manually:');
        console.log('\n1. Go to your Supabase dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Run this SQL command:');
        console.log('\nALTER TABLE issues');
        console.log('ADD COLUMN IF NOT EXISTS solved_date TIMESTAMP WITH TIME ZONE,');
        console.log('ADD COLUMN IF NOT EXISTS solver_name TEXT,');
        console.log('ADD COLUMN IF NOT EXISTS solver_avatar TEXT,');
        console.log('ADD COLUMN IF NOT EXISTS after_image TEXT;');
        console.log('\n4. Then run this script again');
        return false;
      }
      
      return false;
    }
    
    console.log('✅ Issue converted to success story successfully!');
    console.log('Updated issue:', updatedIssue);
    
    // Verify the success story can be queried
    console.log('\n3. Verifying success story query...');
    
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
      console.log('✅ Success story query works!');
      console.log('Found success story:', successStories[0].title);
      return true;
    } else {
      console.log('⚠️  No success stories found in query');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return false;
  }
}

createSampleSuccessStory().then(success => {
  if (success) {
    console.log('\n🎉 Success story created successfully!');
    console.log('\nThe Success Stories feature should now work on:');
    console.log('- Homepage');
    console.log('- Issues page');
    console.log('\nRefresh your browser to see the success stories!');
  } else {
    console.log('\n❌ Failed to create success story.');
    console.log('\nNext steps:');
    console.log('1. Make sure the database migration is run first');
    console.log('2. Check the console output above for specific instructions');
  }
  process.exit(0);
});