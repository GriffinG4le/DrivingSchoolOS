const LS_KEY = 'student-fee-mock-db-v1';

function nowIso() {
  return new Date().toISOString();
}

function randomReceipt() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'MOCK';
  for (let i = 0; i < 8; i += 1) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

function year() {
  return new Date().getFullYear().toString();
}

function pad6(n) {
  return String(n).padStart(6, '0');
}

function defaultState() {
  return {
    schoolCode: 'SCH',
    courses: [
      {
        course_id: 1,
        course_name: 'Diploma in IT',
        fee_amount: 500000, // cents
        duration_months: 12,
        active: 1,
      },
      {
        course_id: 2,
        course_name: 'Certificate in Computer Packages',
        fee_amount: 150000, // cents
        duration_months: 3,
        active: 1,
      },
    ],
    students: [],
    admissions: [],
    payments: [],
    unmatchedPayments: [],
    counters: {
      student_id: 0,
      admission_id: 0,
      payment_id: 0,
      admission_seq_by_year: {},
    },
  };
}

function load() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

function save(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function computeStatus(totalFee, totalPaid) {
  if (totalPaid <= 0) return 'UNPAID';
  if (totalPaid > 0 && totalPaid < totalFee) return 'PARTIAL';
  if (totalPaid === totalFee) return 'CLEARED';
  return 'OVERPAID';
}

export function resetMockDb() {
  const state = defaultState();
  save(state);
  return state;
}

export function getCourses() {
  const state = load();
  return state.courses.filter((c) => c.active === 1);
}

export function createCourse({ course_name, fee_amount, duration_months }) {
  const state = load();
  const nextId = Math.max(0, ...state.courses.map((c) => c.course_id)) + 1;
  const row = {
    course_id: nextId,
    course_name,
    fee_amount,
    duration_months: duration_months ?? null,
    active: 1,
  };
  state.courses.push(row);
  save(state);
  return row;
}

export function createAdmission({ full_name, national_id, phone, course_id }) {
  const state = load();
  const course = state.courses.find(
    (c) => c.course_id === Number(course_id) && c.active === 1
  );
  if (!course) {
    const err = new Error('Invalid course_id');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  state.counters.student_id += 1;
  const student = {
    student_id: state.counters.student_id,
    full_name,
    national_id: national_id || null,
    phone: phone || null,
    created_at: nowIso(),
  };
  state.students.push(student);

  const y = year();
  if (!state.counters.admission_seq_by_year[y]) {
    state.counters.admission_seq_by_year[y] = 0;
  }
  state.counters.admission_seq_by_year[y] += 1;
  const admission_number = `${state.schoolCode}-${y}-${pad6(
    state.counters.admission_seq_by_year[y]
  )}`;

  state.counters.admission_id += 1;
  const admission = {
    admission_id: state.counters.admission_id,
    student_id: student.student_id,
    admission_number,
    course_id: course.course_id,
    fee_amount_snapshot: course.fee_amount,
    status: 'UNPAID',
    created_at: nowIso(),
  };
  state.admissions.push(admission);

  save(state);

  return {
    admission,
    payment_instructions: {
      paybill: 'YOUR_PAYBILL',
      account_reference: admission.admission_number,
    },
  };
}

export function listPayments({ admission_number } = {}) {
  const state = load();
  const payments = admission_number
    ? state.payments.filter((p) => p.admission_number === admission_number)
    : state.payments.slice();
  payments.sort((a, b) =>
    (b.transaction_time || '').localeCompare(a.transaction_time || '')
  );
  return payments;
}

export function recordPayment({
  admission_number,
  amount,
  mpesa_receipt,
  payer_phone,
  payer_name,
  transaction_time,
  raw_payload,
}) {
  const state = load();
  const admission = state.admissions.find(
    (a) => a.admission_number === admission_number
  );

  if (!admission) {
    state.counters.payment_id += 1;
    const row = {
      payment_id: state.counters.payment_id,
      admission_number: admission_number || null,
      amount,
      mpesa_receipt: mpesa_receipt || randomReceipt(),
      payer_phone: payer_phone || null,
      payer_name: payer_name || null,
      transaction_time: transaction_time || nowIso(),
      raw_payload: raw_payload || null,
      created_at: nowIso(),
    };
    state.unmatchedPayments.push(row);
    save(state);
    return { unmatched: true, payment: row };
  }

  if (state.payments.some((p) => p.mpesa_receipt === mpesa_receipt)) {
    const err = new Error('Duplicate mpesa_receipt');
    err.code = 'DUPLICATE';
    throw err;
  }

  state.counters.payment_id += 1;
  const row = {
    payment_id: state.counters.payment_id,
    admission_number,
    amount,
    mpesa_receipt,
    payer_phone: payer_phone || null,
    payer_name: payer_name || null,
    transaction_time: transaction_time || nowIso(),
    raw_payload: raw_payload || null,
    created_at: nowIso(),
  };
  state.payments.push(row);

  const totalPaid = state.payments
    .filter((p) => p.admission_number === admission_number)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  admission.status = computeStatus(admission.fee_amount_snapshot, totalPaid);

  save(state);
  return { unmatched: false, payment: row };
}

export function feeSummary(admission_number) {
  const state = load();
  const admission = state.admissions.find(
    (a) => a.admission_number === admission_number
  );
  if (!admission) return null;

  const student = state.students.find((s) => s.student_id === admission.student_id);
  const course = state.courses.find((c) => c.course_id === admission.course_id);
  const payments = state.payments.filter((p) => p.admission_number === admission_number);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalFee = admission.fee_amount_snapshot;
  const balance = totalFee - totalPaid;
  const status = computeStatus(totalFee, totalPaid);

  return {
    admission_number,
    enrolled_at: admission.created_at,
    full_name: student?.full_name || 'Unknown',
    phone: student?.phone || null,
    course_name: course?.course_name || 'Unknown',
    total_fee: totalFee,
    total_paid: totalPaid,
    balance,
    status,
    payments: payments
      .slice()
      .sort((a, b) => (b.transaction_time || '').localeCompare(a.transaction_time || '')),
  };
}

export function livePaymentFeed({ limit = 25 } = {}) {
  const state = load();
  const allRows = state.payments
    .slice()
    .sort((a, b) => (b.transaction_time || '').localeCompare(a.transaction_time || ''));
  return allRows.slice(0, limit);
}

export function listUnmatchedPayments() {
  const state = load();
  return state.unmatchedPayments
    .slice()
    .sort((a, b) => (b.transaction_time || '').localeCompare(a.transaction_time || ''));
}

export function assignUnmatchedPayment({ payment_id, admission_number }) {
  const state = load();
  const idx = state.unmatchedPayments.findIndex((p) => p.payment_id === payment_id);
  if (idx < 0) {
    const err = new Error('Payment not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const admission = state.admissions.find(
    (a) => a.admission_number === admission_number
  );
  if (!admission) {
    const err = new Error('Admission not found');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const row = state.unmatchedPayments.splice(idx, 1)[0];
  row.admission_number = admission_number;

  if (state.payments.some((p) => p.mpesa_receipt === row.mpesa_receipt)) {
    state.unmatchedPayments.push(row);
    save(state);
    const err = new Error('mpesa_receipt already exists in payments');
    err.code = 'DUPLICATE';
    throw err;
  }

  state.payments.push(row);

  const totalPaid = state.payments
    .filter((p) => p.admission_number === admission_number)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  admission.status = computeStatus(admission.fee_amount_snapshot, totalPaid);

  save(state);
  return row;
}

export function searchAdmissions(query) {
  const q = String(query || '').trim().toLowerCase();
  const state = load();
  if (!q) return [];

  const results = state.admissions
    .map((a) => {
      const s = state.students.find((st) => st.student_id === a.student_id);
      const c = state.courses.find((co) => co.course_id === a.course_id);
      return {
        admission_number: a.admission_number,
        status: a.status,
        created_at: a.created_at,
        full_name: s?.full_name || '',
        phone: s?.phone || '',
        national_id: s?.national_id || '',
        course_name: c?.course_name || '',
        fee_amount_snapshot: a.fee_amount_snapshot,
      };
    })
    .filter((row) => {
      return (
        row.admission_number.toLowerCase().includes(q) ||
        row.full_name.toLowerCase().includes(q) ||
        String(row.phone || '').toLowerCase().includes(q) ||
        String(row.national_id || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return results.slice(0, 50);
}

