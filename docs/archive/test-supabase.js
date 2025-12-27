#!/usr/bin/env node

/**
 * Test Supabase Connection
 * Run with: node test-supabase.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzqtjhoevvjxdgocnfju.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cXRqaG9ldnZqeGRnb2NuZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTk5MjksImV4cCI6MjA3NzM5NTkyOX0.Y_z1NwNMsGtgJk-0opVJv4ZHj0mCSc7taQsuwcA7jJ0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  
  try {
    // Test basic connection
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase.from('issues').select('count').limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      console.log('Error details:', error);
      return false;
    }
    
    console.log('✅ Basic connection successful');
    
    // Test issues table
    console.log('\n2. Testing issues table...');
    const { data: issues, error: issuesError } = await supabase
      .from('issues')
      .select('*')
      .limit(5);
    
    if (issuesError) {
      console.log('❌ Issues table error:', issuesError.message);
      console.log('This might mean the table doesn\'t exist yet.');
    } else {
      console.log('✅ Issues table accessible');
      console.log(`Found ${issues.length} issues`);
      if (issues.length > 0) {
        console.log('Sample issue:', issues[0]);
      }
    }
    
    // Test for solved issues with after_image
    console.log('\n3. Testing for success stories...');
    const { data: successStories, error: storiesError } = await supabase
      .from('issues')
      .select('*')
      .eq('status', 'solved')
      .not('after_image', 'is', null)
      .limit(3);
    
    if (storiesError) {
      console.log('❌ Success stories query error:', storiesError.message);
    } else {
      console.log('✅ Success stories query successful');
      console.log(`Found ${successStories.length} success stories`);
      if (successStories.length > 0) {
        console.log('Sample success story:', successStories[0]);
      } else {
        console.log('ℹ️  No success stories found (this is why the component might not show)');
      }
    }
    
    // Test auth
    console.log('\n4. Testing authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('❌ Auth error:', authError.message);
    } else {
      console.log('✅ Auth connection successful');
      console.log('Current user:', user ? 'Logged in' : 'Not logged in');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n🎉 Supabase configuration looks good!');
  } else {
    console.log('\n❌ There are issues with your Supabase configuration.');
    console.log('\nTroubleshooting steps:');
    console.log('1. Check your Supabase URL and anon key');
    console.log('2. Make sure your database tables are set up');
    console.log('3. Check your Row Level Security (RLS) policies');
    console.log('4. Verify your project is not paused');
  }
  process.exit(0);
});