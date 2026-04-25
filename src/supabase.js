import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The single trip row we read/write
export const TRIP_ID = 'japan-2026';

// Storage bucket for file attachments
export const STORAGE_BUCKET = 'attachments';

// Upload a file to Supabase storage, returns public URL
export async function uploadFile(file, pathPrefix = 'misc') {
  const ext = file.name.split('.').pop();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${pathPrefix}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return {
    name: file.name,
    path,
    url: data.publicUrl,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

// Delete a file from storage
export async function deleteFile(path) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);
  if (error) throw error;
}
