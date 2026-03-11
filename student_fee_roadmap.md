# Student Admission & M-Pesa Fee Tracking System -- Roadmap

## Project Mission

Build a system that: 1. Enrolls students. 2. Assigns a unique admission
number. 3. Maps M-Pesa paybill payments to that admission number. 4.
Tracks fees in real time. 5. Shows whether a student has cleared their
fees.

------------------------------------------------------------------------

## Core Concept

-   Every student gets a **unique admission number**.
-   The admission number is used as the **M-Pesa account reference**.
-   Any payment made using that admission number is automatically mapped
    to the student.
-   The system calculates:
    -   Total fee
    -   Total paid
    -   Balance
    -   Fee status

------------------------------------------------------------------------

## System Components

### 1. Student Enrollment Module

Inputs: - Full name - National ID or birth certificate - Phone number -
Course selection

System actions: - Generate unique admission number - Assign course fee
automatically - Create student fee account

Outputs: - Admission number - Fee amount - Payment instructions

------------------------------------------------------------------------

### 2. Course Module

Stores: - Course name - Course fee - Course duration - Status
(active/inactive)

Purpose: - Auto-fill fee during admission.

------------------------------------------------------------------------

### 3. Payment Processing Module

Source: - M-Pesa Daraja Paybill transactions

Logic: - Read `accountReference` from transaction. - Match it with
admission number. - Record payment in ledger. - Recompute balance and
status.

------------------------------------------------------------------------

### 4. Fee Ledger Module

For each student: - Total course fee - Sum of all payments - Remaining
balance - Fee status

Fee statuses: - UNPAID - PARTIAL - CLEARED - OVERPAID

------------------------------------------------------------------------

### 5. M-Pesa Integration

Use Daraja API: - C2B Validation URL (optional but recommended) - C2B
Confirmation URL (required)

Flow: 1. Student pays via paybill. 2. M-Pesa sends confirmation to
system. 3. System records payment. 4. Fee status updates instantly.

------------------------------------------------------------------------

## Database Design (Minimum Tables)

### courses

-   course_id (PK)
-   course_name
-   fee_amount
-   active

### students

-   student_id (PK)
-   full_name
-   national_id
-   phone
-   created_at

### admissions

-   admission_id (PK)
-   student_id (FK)
-   admission_number (unique)
-   course_id (FK)
-   fee_amount_snapshot
-   status
-   created_at

### payments

-   payment_id (PK)
-   admission_number
-   amount
-   mpesa_receipt (unique)
-   payer_phone
-   payer_name
-   transaction_time
-   raw_payload
-   created_at

------------------------------------------------------------------------

## Admission Number Strategy

Format example: - SCH-2026-000123

Structure: - Prefix (school code) - Year - Sequential number

Must be: - Unique - Permanent - Never reused

------------------------------------------------------------------------

## Admin Interface (Minimum Screens)

### 1. New Admission

-   Enter student details
-   Select course
-   Generate admission number

### 2. Student Search

Search by: - Name - Phone - National ID - Admission number

### 3. Student Fee Page

Shows: - Total fee - Payments list - Balance - Status

### 4. Live Payment Feed

-   Real-time incoming payments

### 5. Unmatched Payments

-   Payments with invalid admission numbers
-   Manual assignment to students

------------------------------------------------------------------------

## Build Plan (Fastest Path -- 14 Days)

### Phase 1: Core Setup (Days 1--3)

-   Create backend project.
-   Set up database.
-   Create tables:
    -   courses
    -   students
    -   admissions
    -   payments

Deliverable: - Database and basic API running.

------------------------------------------------------------------------

### Phase 2: Admission System (Days 4--6)

-   Create admission number generator.
-   Build enrollment endpoint.
-   Auto-assign course fee.
-   Store admission record.

Deliverable: - Working student enrollment system.

------------------------------------------------------------------------

### Phase 3: Fee Ledger (Days 7--8)

-   Build payment table logic.
-   Create fee summary calculation.
-   Show:
    -   Total fee
    -   Total paid
    -   Balance
    -   Status

Deliverable: - Student fee status page working.

------------------------------------------------------------------------

### Phase 4: M-Pesa Integration (Days 9--11)

-   Implement Daraja confirmation endpoint.
-   Record payments from callbacks.
-   Prevent duplicate receipts.
-   Auto-update fee status.

Deliverable: - Real-time payment recording.

------------------------------------------------------------------------

### Phase 5: Admin Dashboard (Days 12--14)

-   Admission form UI.
-   Student search page.
-   Fee status page.
-   Payment feed.

Deliverable: - Usable admin interface.

------------------------------------------------------------------------

## Critical System Rules

1.  Admission number must be unique.
2.  Each M-Pesa receipt must be stored once only.
3.  Fee status must be computed from the ledger.
4.  Course fee must be snapshotted at admission.
5.  System must handle partial and overpayments.

------------------------------------------------------------------------

## Success Criteria

The system is successful when: - A student is enrolled in under 2
minutes. - Payments map automatically to students. - Fee status updates
instantly after payment. - Staff can see balances without manual
calculations.

------------------------------------------------------------------------

## Stretch Features (After MVP)

-   SMS fee balance notifications.
-   Parent portal.
-   Receipt printing.
-   Installment plans.
-   Multi-branch support.
-   Accounting export.

------------------------------------------------------------------------

## Execution Rule

Ship a working enrollment + payment mapping system first. Do not
overbuild. No unnecessary features before the core flow works.
