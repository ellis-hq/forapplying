-- Create the beta_signups table
create table public.beta_signups (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.beta_signups enable row level security;

-- Allow anyone to insert (anon)
create policy "Enable insert for all users" on public.beta_signups
  for insert with check (true);
