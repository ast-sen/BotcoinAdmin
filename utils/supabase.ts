// Alternative configuration without url-polyfill
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ynpsylopscpnxjxoulhd.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucHN5bG9wc2NwbnhqeG91bGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMzYwODUsImV4cCI6MjA3MDkxMjA4NX0.1LQfFcaFtiFT8mVEbR6nLRsZokAr3mQmYmb3DKo63gc"
// Debug: Check if environment variables are loaded
console.log('Supabase URL:', supabaseUrl ? 'Loaded' : 'Missing');
console.log('Supabase Key:', supabaseAnonKey ? 'Loaded' : 'Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.error('URL:', supabaseUrl);
  console.error('Key:', supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Test connection function (for debugging)
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('user_profiles').select('count');
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('Supabase connection successful');
    return true;
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return false;
  }
};