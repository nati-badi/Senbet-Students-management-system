import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In Expo, we use process.env or a config file. 
// For now, these should be replaced with the actual values or passed via Expo secrets.
const supabaseUrl = 'https://cmmldovyubejoudamyll.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtbWxkb3Z5dWJlam91ZGFteWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzM5MTUsImV4cCI6MjA4ODY0OTkxNX0.5-ahguRVYMVWM_3DhEM9sfXHbGGw7HnC6NnOZYCw7tA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
