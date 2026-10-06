-- Profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'accountant', 'staff')),
  display_name text,
  created_at timestamptz not null default now()
);

-- Seed existing auth users as owner
insert into public.profiles (id, role)
select id, 'owner'
from auth.users
on conflict (id) do nothing;

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Everyone can read profiles
create policy "profiles_select" on public.profiles
  for select using (true);

-- Only owner can insert/update/delete profiles
create policy "profiles_owner_modify" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- RLS on money tables: accountant + owner full, staff read-only
-- operational_expenses
alter table public.operational_expenses enable row level security;
drop policy if exists "oe_select" on public.operational_expenses;
create policy "oe_select" on public.operational_expenses
  for select using (true);
drop policy if exists "oe_modify" on public.operational_expenses;
create policy "oe_modify" on public.operational_expenses
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'accountant')
    )
  );

-- client_invoices
alter table public.client_invoices enable row level security;
drop policy if exists "ci_select" on public.client_invoices;
create policy "ci_select" on public.client_invoices
  for select using (true);
drop policy if exists "ci_modify" on public.client_invoices;
create policy "ci_modify" on public.client_invoices
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'accountant')
    )
  );

-- vat_tax_payments
alter table public.vat_tax_payments enable row level security;
drop policy if exists "vtp_select" on public.vat_tax_payments;
create policy "vtp_select" on public.vat_tax_payments
  for select using (true);
drop policy if exists "vtp_modify" on public.vat_tax_payments;
create policy "vtp_modify" on public.vat_tax_payments
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'accountant')
    )
  );

-- bank_transactions
alter table public.bank_transactions enable row level security;
drop policy if exists "bt_select" on public.bank_transactions;
create policy "bt_select" on public.bank_transactions
  for select using (true);
drop policy if exists "bt_modify" on public.bank_transactions;
create policy "bt_modify" on public.bank_transactions
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'accountant')
    )
  );
