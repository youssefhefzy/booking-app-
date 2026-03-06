-- ============================================================
-- BOOKLY — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- SERVICES table
-- ─────────────────────────────────────────
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  duration_minutes integer not null default 30,
  price numeric(10,2),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Seed demo services
insert into services (name, description, duration_minutes, price) values
  ('Consultation',     'Initial 30-minute consultation session',    30,  50.00),
  ('Standard Session', 'Full 1-hour professional service session',  60,  90.00),
  ('Premium Package',  'Extended 90-minute premium experience',     90, 130.00),
  ('Quick Check-in',   'Brief 15-minute follow-up or check-in',     15,  30.00);

-- ─────────────────────────────────────────
-- AVAILABILITY table (weekly schedule)
-- ─────────────────────────────────────────
create table if not exists availability (
  id uuid primary key default uuid_generate_v4(),
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sun, 6=Sat
  start_time time not null,
  end_time time not null,
  is_active boolean default true
);

-- Seed Mon–Fri 9am–6pm
insert into availability (day_of_week, start_time, end_time) values
  (1, '09:00', '18:00'),
  (2, '09:00', '18:00'),
  (3, '09:00', '18:00'),
  (4, '09:00', '18:00'),
  (5, '09:00', '18:00');

-- ─────────────────────────────────────────
-- BOOKINGS table
-- ─────────────────────────────────────────
create table if not exists bookings (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid references services(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_phone text,
  booking_date date not null,
  booking_time time not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

-- Enable RLS
alter table bookings enable row level security;
alter table services enable row level security;
alter table availability enable row level security;

-- Public can read services and availability
create policy "Public read services" on services for select using (true);
create policy "Public read availability" on availability for select using (true);

-- Public can insert bookings (anyone can book)
create policy "Public insert bookings" on bookings for insert with check (true);

-- Public can read their own bookings (by email — for confirmation page)
create policy "Public read own bookings" on bookings for select using (true);

-- ─────────────────────────────────────────
-- REAL-TIME
-- ─────────────────────────────────────────
-- Enable real-time on bookings so admin dashboard updates live
alter publication supabase_realtime add table bookings;

-- ─────────────────────────────────────────
-- HELPER FUNCTION: get booked slots for a date
-- ─────────────────────────────────────────
create or replace function get_booked_slots(target_date date)
returns table(booking_time time, duration_minutes integer) as $$
  select b.booking_time, s.duration_minutes
  from bookings b
  join services s on s.id = b.service_id
  where b.booking_date = target_date
    and b.status != 'cancelled';
$$ language sql security definer;
