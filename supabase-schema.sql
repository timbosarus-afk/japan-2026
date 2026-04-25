-- ============================================================================
-- JAPAN 2026 HOLIDAY APP — SUPABASE SCHEMA
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This sets up:
--   1. trips table for storing app data
--   2. storage bucket for file attachments (PDFs, photos)
--   3. permissive policies so anyone with the URL can read/write
--
-- Security note: this is shared-by-URL. Anyone who has your Vercel URL can
-- read and write all data. Don't put sensitive info like credit card numbers.
-- ============================================================================


-- 1. Create the trips table
create table if not exists trips (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

-- 2. Enable Row Level Security
alter table trips enable row level security;

-- 3. Policies: allow anon (anyone with the URL) to read, insert, update
create policy "anon can read trips"
  on trips for select
  to anon
  using (true);

create policy "anon can insert trips"
  on trips for insert
  to anon
  with check (true);

create policy "anon can update trips"
  on trips for update
  to anon
  using (true)
  with check (true);


-- 4. Create storage bucket for file attachments
-- Use the Supabase dashboard instead: Storage → New bucket → name "attachments" → Public: ON
-- OR run this (may require service_role key):
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 5. Policies for the storage bucket
create policy "anon can upload attachments"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'attachments');

create policy "anon can read attachments"
  on storage.objects for select
  to anon
  using (bucket_id = 'attachments');

create policy "anon can delete attachments"
  on storage.objects for delete
  to anon
  using (bucket_id = 'attachments');

create policy "anon can update attachments"
  on storage.objects for update
  to anon
  using (bucket_id = 'attachments');
