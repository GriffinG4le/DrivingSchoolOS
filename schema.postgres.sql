-- Postgres schema (recommended for production)
create extension if not exists "uuid-ossp";

drop view if exists admission_balances;
drop table if exists users;
drop table if exists branches;
drop table if exists schools;
drop table if exists exam_registrations;
drop table if exists unmatched_payments;
drop table if exists payments;
drop table if exists admissions;
drop table if exists students;
drop table if exists courses;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'admission_status') then
    create type admission_status as enum ('UNPAID','PARTIAL','CLEARED','OVERPAID');
  end if;
end
$$;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Tenancy: schools and branches
create table schools (
  school_id    uuid primary key default uuid_generate_v4(),
  name         text not null,
  code         text not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_schools_updated_at
before update on schools
for each row execute function set_updated_at();

create table branches (
  branch_id    uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references schools(school_id)
                 on update cascade on delete restrict,
  name         text not null,
  code         text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint branches_school_code_unique unique (school_id, code)
);

create index idx_branches_school_id on branches(school_id);

create trigger trg_branches_updated_at
before update on branches
for each row execute function set_updated_at();

-- Users & RBAC (scope is encoded by role + optional branch_id)
create table users (
  user_id       uuid primary key default uuid_generate_v4(),
  school_id     uuid references schools(school_id)
                  on update cascade on delete restrict,
  branch_id     uuid references branches(branch_id)
                  on update cascade on delete restrict,
  role          text not null check (role in ('SUPER_ADMIN','SCHOOL_ADMIN','SECRETARY','CASHIER','VIEWER')),
  full_name     text not null,
  email         text not null,
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint users_email_unique unique (email),
  constraint users_branch_belongs_to_school
    check (branch_id is null or school_id is not null)
);

create index idx_users_school_id on users(school_id);
create index idx_users_branch_id on users(branch_id);

create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

create table courses (
  course_id        uuid primary key default uuid_generate_v4(),
  school_id        uuid not null references schools(school_id)
                    on update cascade on delete restrict,
  course_name      text not null,
  fee_amount       numeric(12,2) not null check (fee_amount >= 0),
  duration_months  integer check (duration_months > 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_courses_school_id on courses(school_id);
alter table courses add constraint courses_school_course_name_unique unique (school_id, course_name);

create table students (
  student_id   uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references schools(school_id)
                on update cascade on delete restrict,
  branch_id    uuid references branches(branch_id)
                on update cascade on delete restrict,
  full_name    text not null,
  national_id  text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint students_national_id_unique unique (school_id, national_id)
);

create index idx_students_school_id on students(school_id);
create index idx_students_branch_id on students(branch_id);
create index idx_students_national_id on students(national_id);
create index idx_students_phone on students(phone);

create table admissions (
  admission_id            uuid primary key default uuid_generate_v4(),
  school_id               uuid not null references schools(school_id)
                            on update cascade on delete restrict,
  branch_id               uuid references branches(branch_id)
                            on update cascade on delete restrict,
  student_id              uuid not null references students(student_id)
                            on update cascade on delete restrict,
  admission_number        text not null,
  course_id               uuid not null references courses(course_id)
                            on update cascade on delete restrict,
  fee_amount_snapshot     numeric(12,2) not null check (fee_amount_snapshot >= 0),
  status                  admission_status not null default 'UNPAID',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_admissions_school_id on admissions(school_id);
create index idx_admissions_branch_id on admissions(branch_id);
create index idx_admissions_student_id on admissions(student_id);
create index idx_admissions_course_id on admissions(course_id);
create index idx_admissions_admission_number on admissions(admission_number);

-- Admission numbers should be unique within a school (composite key for FKs)
alter table admissions add constraint admissions_school_admission_number_unique unique (school_id, admission_number);

create table payments (
  payment_id       uuid primary key default uuid_generate_v4(),
  school_id        uuid not null references schools(school_id)
                    on update cascade on delete restrict,
  branch_id        uuid references branches(branch_id)
                    on update cascade on delete restrict,
  admission_number text not null,
  amount           numeric(12,2) not null check (amount > 0),
  mpesa_receipt    text not null unique,
  payer_phone      text,
  payer_name       text,
  transaction_time timestamptz,
  raw_payload      jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table payments
  add constraint payments_admission_fk
  foreign key (school_id, admission_number)
  references admissions(school_id, admission_number)
  on update cascade on delete restrict;

create index idx_payments_school_id on payments(school_id);
create index idx_payments_branch_id on payments(branch_id);
create index idx_payments_admission_number on payments(admission_number);
create index idx_payments_mpesa_receipt on payments(mpesa_receipt);

create table unmatched_payments (
  unmatched_payment_id uuid primary key default uuid_generate_v4(),
  school_id            uuid not null references schools(school_id)
                         on update cascade on delete restrict,
  branch_id            uuid references branches(branch_id)
                         on update cascade on delete restrict,
  account_reference    text not null,
  amount               numeric(12,2) not null check (amount > 0),
  mpesa_receipt        text not null unique,
  payer_phone          text,
  payer_name           text,
  transaction_time     timestamptz,
  raw_payload          jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_unmatched_payments_school_id on unmatched_payments(school_id);
create index idx_unmatched_payments_branch_id on unmatched_payments(branch_id);
create index idx_unmatched_payments_account_reference on unmatched_payments(account_reference);
create index idx_unmatched_payments_mpesa_receipt on unmatched_payments(mpesa_receipt);

create table exam_registrations (
  exam_registration_id uuid primary key default uuid_generate_v4(),
  school_id            uuid not null references schools(school_id)
                         on update cascade on delete restrict,
  branch_id            uuid references branches(branch_id)
                         on update cascade on delete restrict,
  admission_number     text not null,
  exam_date            date not null,
  status               text not null default 'REGISTERED'
                         check (status in ('REGISTERED','SAT','CANCELLED')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table exam_registrations
  add constraint exam_registrations_admission_fk
  foreign key (school_id, admission_number)
  references admissions(school_id, admission_number)
  on update cascade on delete restrict;

create index idx_exam_registrations_school_id on exam_registrations(school_id);
create index idx_exam_registrations_branch_id on exam_registrations(branch_id);
create index idx_exam_registrations_admission_number on exam_registrations(admission_number);
create index idx_exam_registrations_exam_date on exam_registrations(exam_date);

create view admission_balances as
select
  a.school_id,
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
group by a.school_id, a.admission_number, s.full_name, c.course_name, a.fee_amount_snapshot;

create trigger trg_courses_updated_at
before update on courses
for each row execute function set_updated_at();

create trigger trg_students_updated_at
before update on students
for each row execute function set_updated_at();

create trigger trg_admissions_updated_at
before update on admissions
for each row execute function set_updated_at();

create trigger trg_payments_updated_at
before update on payments
for each row execute function set_updated_at();

create trigger trg_unmatched_payments_updated_at
before update on unmatched_payments
for each row execute function set_updated_at();

create trigger trg_exam_registrations_updated_at
before update on exam_registrations
for each row execute function set_updated_at();

