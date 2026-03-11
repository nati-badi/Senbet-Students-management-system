import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cmmldovyubejoudamyll.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtbWxkb3Z5dWJlam91ZGFteWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzM5MTUsImV4cCI6MjA4ODY0OTkxNX0.5-ahguRVYMVWM_3DhEM9sfXHbGGw7HnC6NnOZYCw7tA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
