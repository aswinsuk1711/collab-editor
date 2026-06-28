-- ============================================================
-- Collabit — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  created_at timestamptz default now()
);

-- ============================================================
-- documents
-- ============================================================
create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null default 'Untitled Document',
  owner_id uuid not null,
  content text default '',
  ydoc_state text,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- document_access: shared access
-- ============================================================
create table if not exists public.document_access (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null,
  user_id uuid not null,
  created_at timestamptz default now(),
  unique(document_id, user_id)
);

-- ============================================================
-- document_history: snapshots
-- ============================================================
create table if not exists public.document_history (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null,
  user_id uuid,
  snapshot text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Foreign keys (added after all tables exist)
-- ============================================================
alter table public.documents
  add constraint documents_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete cascade;

alter table public.document_access
  add constraint document_access_document_id_fkey
  foreign key (document_id) references public.documents(id) on delete cascade,
  add constraint document_access_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.document_history
  add constraint document_history_document_id_fkey
  foreign key (document_id) references public.documents(id) on delete cascade,
  add constraint document_history_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;

create policy "Users can read all profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

alter table public.documents enable row level security;

create policy "Owners can do anything with their documents"
  on public.documents for all
  using (auth.uid() = owner_id);

create policy "Users with access can read documents"
  on public.documents for select
  using (
    auth.uid() = owner_id
    or is_public = true
    or exists (
      select 1 from public.document_access
      where document_id = id and user_id = auth.uid()
    )
  );

alter table public.document_access enable row level security;

create policy "Owners can manage access"
  on public.document_access for all
  using (
    exists (
      select 1 from public.documents
      where id = document_id and owner_id = auth.uid()
    )
  );

create policy "Users can view their own access"
  on public.document_access for select
  using (auth.uid() = user_id);

alter table public.document_history enable row level security;

create policy "Document owners and collaborators can read history"
  on public.document_history for select
  using (
    exists (
      select 1 from public.documents
      where id = document_id
      and (
        owner_id = auth.uid()
        or is_public = true
        or exists (
          select 1 from public.document_access
          where document_id = document_id and user_id = auth.uid()
        )
      )
    )
  );

create policy "Backend service can insert history"
  on public.document_history for insert
  with check (true);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists documents_owner_id_idx on public.documents(owner_id);
create index if not exists documents_updated_at_idx on public.documents(updated_at desc);
create index if not exists document_access_user_idx on public.document_access(user_id);
create index if not exists document_access_doc_idx on public.document_access(document_id);
create index if not exists history_doc_idx on public.document_history(document_id, created_at desc);
