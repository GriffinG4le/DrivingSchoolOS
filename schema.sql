-- SQLite schema (this file is executed by `npm run db:init`)
-- Notes:
-- - IDs are stored as TEXT (UUID-like hex) because SQLite has no native UUID type.
-- - `updated_at` is maintained via triggers.

PRAGMA foreign_keys = ON;

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

-- schools & branches (SQLite/dev)
create table schools (
  school_id  text primary key not null default (lower(hex(randomblob(16)))),
  name       text not null,
  code       text not null unique,
  active     integer not null default 1 check (active in (0,1)),
  created_at text not null default (CURRENT_TIMESTAMP),
  updated_at text not null default (CURRENT_TIMESTAMP)
);

create table branches (
  branch_id  text primary key not null default (lower(hex(randomblob(16)))),
  school_id  text not null references schools(school_id)
               on update cascade on delete restrict,
  name       text not null,
  code       text not null,
  active     integer not null default 1 check (active in (0,1)),
  created_at text not null default (CURRENT_TIMESTAMP),
  updated_at text not null default (CURRENT_TIMESTAMP),
  unique (school_id, code)
);

create index idx_branches_school_id on branches(school_id);

create table users (
  user_id        text primary key not null default (lower(hex(randomblob(16)))),
  school_id      text references schools(school_id)
                  on update cascade on delete restrict,
  branch_id      text references branches(branch_id)
                  on update cascade on delete restrict,
  role           text not null check (role in ('SUPER_ADMIN','SCHOOL_ADMIN','SECRETARY','CASHIER','VIEWER')),
  full_name      text not null,
  email          text not null unique,
  password_hash  text not null,
  active         integer not null default 1 check (active in (0,1)),
  created_at     text not null default (CURRENT_TIMESTAMP),
  updated_at     text not null default (CURRENT_TIMESTAMP)
);

create index idx_users_school_id on users(school_id);
create index idx_users_branch_id on users(branch_id);

-- courses table
create table courses (
  course_id        text primary key not null default (lower(hex(randomblob(16)))),
  school_id        text not null references schools(school_id)
                    on update cascade on delete restrict,
  course_name      text not null,
  fee_amount       integer not null check (fee_amount >= 0),
  duration_months  integer check (duration_months > 0),
  active           integer not null default 1 check (active in (0,1)),
  created_at       text not null default (CURRENT_TIMESTAMP),
  updated_at       text not null default (CURRENT_TIMESTAMP),
  unique (school_id, course_name)
);

-- students table
create table students (
  student_id   text primary key not null default (lower(hex(randomblob(16)))),
  school_id    text not null references schools(school_id)
                on update cascade on delete restrict,
  branch_id    text references branches(branch_id)
                on update cascade on delete restrict,
  full_name    text not null,
  national_id  text,
  phone        text,
  created_at   text not null default (CURRENT_TIMESTAMP),
  updated_at   text not null default (CURRENT_TIMESTAMP),
  unique (school_id, national_id)
);

create index idx_students_school_id on students(school_id);
create index idx_students_branch_id on students(branch_id);
create index idx_students_national_id on students(national_id);
create index idx_students_phone on students(phone);

-- admissions table
create table admissions (
  admission_id            text primary key not null default (lower(hex(randomblob(16)))),
  school_id               text not null references schools(school_id)
                            on update cascade on delete restrict,
  branch_id               text references branches(branch_id)
                            on update cascade on delete restrict,
  student_id              text not null references students(student_id)
                            on update cascade on delete restrict,
  admission_number        text not null,
  course_id               text not null references courses(course_id)
                            on update cascade on delete restrict,
  fee_amount_snapshot     integer not null check (fee_amount_snapshot >= 0),
  status                  text not null default 'UNPAID'
                            check (status in ('UNPAID','PARTIAL','CLEARED','OVERPAID')),
  created_at              text not null default (CURRENT_TIMESTAMP),
  updated_at              text not null default (CURRENT_TIMESTAMP),
  unique (school_id, admission_number)
);

create index idx_admissions_school_id on admissions(school_id);
create index idx_admissions_branch_id on admissions(branch_id);
create index idx_admissions_student_id on admissions(student_id);
create index idx_admissions_course_id on admissions(course_id);
create index idx_admissions_admission_number on admissions(admission_number);

-- payments table (kept admission_number FK to match current app code)
create table payments (
  payment_id       text primary key not null default (lower(hex(randomblob(16)))),
  school_id        text not null references schools(school_id)
                    on update cascade on delete restrict,
  branch_id        text references branches(branch_id)
                    on update cascade on delete restrict,
  admission_number text not null,
  amount           integer not null check (amount > 0),
  mpesa_receipt    text not null unique,
  payer_phone      text,
  payer_name       text,
  transaction_time text,
  raw_payload      text,
  created_at       text not null default (CURRENT_TIMESTAMP),
  updated_at       text not null default (CURRENT_TIMESTAMP)
);

create index idx_payments_school_id on payments(school_id);
create index idx_payments_branch_id on payments(branch_id);
create index idx_payments_admission_number on payments(admission_number);
create index idx_payments_mpesa_receipt on payments(mpesa_receipt);

-- unmatched_payments: store M-Pesa callbacks with unknown admission numbers
create table unmatched_payments (
  unmatched_payment_id text primary key not null default (lower(hex(randomblob(16)))),
  school_id            text not null references schools(school_id)
                         on update cascade on delete restrict,
  branch_id            text references branches(branch_id)
                         on update cascade on delete restrict,
  account_reference    text not null,
  amount              integer not null check (amount > 0),
  mpesa_receipt        text not null unique,
  payer_phone         text,
  payer_name          text,
  transaction_time    text,
  raw_payload         text,
  created_at          text not null default (CURRENT_TIMESTAMP),
  updated_at          text not null default (CURRENT_TIMESTAMP)
);

create index idx_unmatched_payments_school_id on unmatched_payments(school_id);
create index idx_unmatched_payments_branch_id on unmatched_payments(branch_id);
create index idx_unmatched_payments_account_reference on unmatched_payments(account_reference);
create index idx_unmatched_payments_mpesa_receipt on unmatched_payments(mpesa_receipt);

-- exam_registrations: student can only be registered when fees cleared
create table exam_registrations (
  exam_registration_id text primary key not null default (lower(hex(randomblob(16)))),
  school_id            text not null references schools(school_id)
                         on update cascade on delete restrict,
  branch_id            text references branches(branch_id)
                         on update cascade on delete restrict,
  admission_number     text not null,
  exam_date            text not null,
  status               text not null default 'REGISTERED'
                         check (status in ('REGISTERED','SAT','CANCELLED')),
  created_at           text not null default (CURRENT_TIMESTAMP),
  updated_at           text not null default (CURRENT_TIMESTAMP)
);

create index idx_exam_registrations_school_id on exam_registrations(school_id);
create index idx_exam_registrations_branch_id on exam_registrations(branch_id);
create index idx_exam_registrations_admission_number on exam_registrations(admission_number);
create index idx_exam_registrations_exam_date on exam_registrations(exam_date);

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

-- updated_at triggers
create trigger trg_courses_updated_at
after update on courses
for each row
begin
  update courses set updated_at = CURRENT_TIMESTAMP where course_id = old.course_id;
end;

create trigger trg_students_updated_at
after update on students
for each row
begin
  update students set updated_at = CURRENT_TIMESTAMP where student_id = old.student_id;
end;

create trigger trg_admissions_updated_at
after update on admissions
for each row
begin
  update admissions set updated_at = CURRENT_TIMESTAMP where admission_id = old.admission_id;
end;

create trigger trg_payments_updated_at
after update on payments
for each row
begin
  update payments set updated_at = CURRENT_TIMESTAMP where payment_id = old.payment_id;
end;

create trigger trg_unmatched_payments_updated_at
after update on unmatched_payments
for each row
begin
  update unmatched_payments set updated_at = CURRENT_TIMESTAMP where unmatched_payment_id = old.unmatched_payment_id;
end;

create trigger trg_exam_registrations_updated_at
after update on exam_registrations
for each row
begin
  update exam_registrations set updated_at = CURRENT_TIMESTAMP where exam_registration_id = old.exam_registration_id;
end;