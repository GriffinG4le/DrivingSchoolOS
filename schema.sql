-- Enable UUID extension (better than integer IDs for production)
create extension if not exists "uuid-ossp";

-- courses table
create table courses (
  course_id        uuid primary key default uuid_generate_v4(),
  course_name      text not null unique,
  fee_amount       integer not null check (fee_amount >= 0),
  duration_months  integer check (duration_months > 0),
  active           boolean not null default true
);

-- students table
create table students (
  student_id   uuid primary key default uuid_generate_v4(),
  full_name    text not null,
  national_id  text,
  phone        text,
  created_at   timestamptz not null default now()
);

create index on students(national_id);
create index on students(phone);

-- admissions table
create table admissions (
  admission_id            uuid primary key default uuid_generate_v4(),
  student_id              uuid not null references students(student_id)
                            on update cascade on delete restrict,
  admission_number        text not null unique,
  course_id               uuid not null references courses(course_id)
                            on update cascade on delete restrict,
  fee_amount_snapshot     integer not null check (fee_amount_snapshot >= 0),
  status                  text not null default 'UNPAID'
                            check (status in ('UNPAID','PARTIAL','CLEARED','OVERPAID')),
  created_at              timestamptz not null default now()
);

create index on admissions(student_id);
create index on admissions(course_id);
create index on admissions(admission_number);

-- payments table
create table payments (
  payment_id       uuid primary key default uuid_generate_v4(),
  admission_number text not null references admissions(admission_number)
                     on update cascade on delete restrict,
  amount           integer not null check (amount > 0),
  mpesa_receipt    text not null unique,
  payer_phone      text,
  payer_name       text,
  transaction_time timestamptz,
  raw_payload      jsonb,
  created_at       timestamptz not null default now()
);

create index on payments(admission_number);
create index on payments(mpesa_receipt);

-- admission_balances view for easy fee lookups
create view admission_balances as
select
  a.admission_number,
  s.full_name as name,
  c.course_name as course,
  a.fee_amount_snapshot as total_fee,
  coalesce(sum(p.amount), 0) as amount_paid,
  a.fee_amount_snapshot - coalesce(sum(p.amount), 0) as balance_remaining,
  case
    when coalesce(sum(p.amount), 0) = 0 then 'UNPAID'
    when coalesce(sum(p.amount), 0) > 0 and coalesce(sum(p.amount), 0) < a.fee_amount_snapshot then 'PARTIAL'
    when coalesce(sum(p.amount), 0) = a.fee_amount_snapshot then 'CLEARED'
    else 'OVERPAID'
  end as status
from admissions a
join students s on s.student_id = a.student_id
join courses c on c.course_id = a.course_id
left join payments p on p.admission_number = a.admission_number
group by a.admission_number, s.full_name, c.course_name, a.fee_amount_snapshot;