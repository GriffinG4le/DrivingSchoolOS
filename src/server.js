require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  run,
  get,
  all,
  generateAdmissionNumber,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PLATFORM_BOOTSTRAP_KEY = process.env.PLATFORM_BOOTSTRAP_KEY || '';

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

function parseDarajaAmount(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function stringifyPayload(payload) {
  try {
    return JSON.stringify(payload ?? null);
  } catch {
    return null;
  }
}

function newId() {
  return crypto.randomUUID().replaceAll('-', '').toLowerCase();
}

function signToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role: user.role,
      school_id: user.school_id || null,
      branch_id: user.branch_id || null,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await get(
      `SELECT user_id, role, school_id, branch_id, full_name, email, active
       FROM users
       WHERE user_id = ?`,
      [payload.user_id]
    );
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid user' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function getScopeFilter(user) {
  if (user.role === 'SUPER_ADMIN') return { school_id: null, branch_id: null, mode: 'platform' };
  if (!user.school_id) return { school_id: null, branch_id: null, mode: 'invalid' };
  if (user.role === 'SCHOOL_ADMIN') return { school_id: user.school_id, branch_id: null, mode: 'school' };
  return { school_id: user.school_id, branch_id: user.branch_id || null, mode: user.branch_id ? 'branch' : 'school' };
}

// Bootstrap super admin (one-time, guarded by PLATFORM_BOOTSTRAP_KEY)
app.post('/platform/bootstrap', async (req, res) => {
  try {
    if (!PLATFORM_BOOTSTRAP_KEY || req.headers['x-platform-key'] !== PLATFORM_BOOTSTRAP_KEY) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: 'full_name, email, password required' });

    const existing = await get("SELECT user_id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1");
    if (existing) return res.status(409).json({ error: 'Super admin already exists' });

    const user_id = newId();
    const password_hash = await bcrypt.hash(password, 12);
    await run(
      `INSERT INTO users (user_id, role, full_name, email, password_hash, active)
       VALUES (?, 'SUPER_ADMIN', ?, ?, ?, 1)`,
      [user_id, full_name, email.toLowerCase(), password_hash]
    );
    const user = await get('SELECT user_id, role, school_id, branch_id, full_name, email FROM users WHERE user_id = ?', [
      user_id,
    ]);
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bootstrap' });
  }
});

// Auth
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await get(
      `SELECT user_id, role, school_id, branch_id, full_name, email, password_hash, active
       FROM users
       WHERE email = ?`,
      [email.toLowerCase()]
    );
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const safeUser = {
      user_id: user.user_id,
      role: user.role,
      school_id: user.school_id,
      branch_id: user.branch_id,
      full_name: user.full_name,
      email: user.email,
    };
    res.json({ user: safeUser, token: signToken(safeUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// Platform: create a school + first school admin (SUPER_ADMIN only)
app.post('/platform/schools', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { school_name, school_code, admin_full_name, admin_email, admin_password, branch_name, branch_code } = req.body;
    if (!school_name || !school_code || !admin_full_name || !admin_email || !admin_password) {
      return res.status(400).json({ error: 'school_name, school_code, admin_full_name, admin_email, admin_password required' });
    }
    const school_id = newId();
    await run('INSERT INTO schools (school_id, name, code, active) VALUES (?, ?, ?, 1)', [
      school_id,
      school_name,
      school_code.toUpperCase(),
    ]);

    let created_branch = null;
    if (branch_name && branch_code) {
      const branch_id = newId();
      await run('INSERT INTO branches (branch_id, school_id, name, code, active) VALUES (?, ?, ?, ?, 1)', [
        branch_id,
        school_id,
        branch_name,
        branch_code.toUpperCase(),
      ]);
      created_branch = await get('SELECT branch_id, school_id, name, code FROM branches WHERE branch_id = ?', [branch_id]);
    }

    const admin_user_id = newId();
    const password_hash = await bcrypt.hash(admin_password, 12);
    await run(
      `INSERT INTO users (user_id, school_id, role, full_name, email, password_hash, active)
       VALUES (?, ?, 'SCHOOL_ADMIN', ?, ?, ?, 1)`,
      [admin_user_id, school_id, admin_full_name, admin_email.toLowerCase(), password_hash]
    );

    const school = await get('SELECT school_id, name, code, active FROM schools WHERE school_id = ?', [school_id]);
    const admin = await get(
      'SELECT user_id, role, school_id, branch_id, full_name, email FROM users WHERE user_id = ?',
      [admin_user_id]
    );
    res.status(201).json({ school, branch: created_branch, admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create school' });
  }
});

// School admin: create branch
app.post('/school/branches', requireAuth, requireRole('SCHOOL_ADMIN'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name and code required' });
    const branch_id = newId();
    await run('INSERT INTO branches (branch_id, school_id, name, code, active) VALUES (?, ?, ?, ?, 1)', [
      branch_id,
      req.user.school_id,
      name,
      code.toUpperCase(),
    ]);
    const branch = await get('SELECT branch_id, school_id, name, code, active FROM branches WHERE branch_id = ?', [branch_id]);
    res.status(201).json(branch);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// School admin: create a user (secretary/cashier/viewer)
app.post('/school/users', requireAuth, requireRole('SCHOOL_ADMIN'), async (req, res) => {
  try {
    const { role, full_name, email, password, branch_id } = req.body;
    if (!role || !full_name || !email || !password) {
      return res.status(400).json({ error: 'role, full_name, email, password required' });
    }
    if (!['SECRETARY', 'CASHIER', 'VIEWER', 'SCHOOL_ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let resolvedBranchId = branch_id || null;
    if (resolvedBranchId) {
      const branch = await get('SELECT branch_id FROM branches WHERE branch_id = ? AND school_id = ?', [
        resolvedBranchId,
        req.user.school_id,
      ]);
      if (!branch) return res.status(400).json({ error: 'Invalid branch_id' });
    }

    const user_id = newId();
    const password_hash = await bcrypt.hash(password, 12);
    await run(
      `INSERT INTO users (user_id, school_id, branch_id, role, full_name, email, password_hash, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [user_id, req.user.school_id, resolvedBranchId, role, full_name, email.toLowerCase(), password_hash]
    );
    const user = await get(
      'SELECT user_id, role, school_id, branch_id, full_name, email, active FROM users WHERE user_id = ?',
      [user_id]
    );
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Create a course
app.post('/courses', requireAuth, requireRole('SCHOOL_ADMIN'), async (req, res) => {
  try {
    const { course_name, fee_amount, duration_months } = req.body;

    if (!course_name || typeof fee_amount !== 'number') {
      return res.status(400).json({
        error: 'course_name and numeric fee_amount are required',
      });
    }

    const course_id = newId();
    await run(
      `INSERT INTO courses (course_id, school_id, course_name, fee_amount, duration_months, active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [course_id, req.user.school_id, course_name, fee_amount, duration_months || null]
    );

    const course = await get(
      'SELECT course_id, course_name, fee_amount, duration_months, active FROM courses WHERE course_id = ? AND school_id = ?',
      [course_id, req.user.school_id]
    );

    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// List active courses
app.get('/courses', requireAuth, async (req, res) => {
  try {
    const courses = await all(
      'SELECT course_id, course_name, fee_amount, duration_months, active FROM courses WHERE school_id = ? AND active = 1 ORDER BY course_name',
      [req.user.school_id]
    );
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

// New student admission (enrollment)
app.post('/admissions', requireAuth, requireRole('SCHOOL_ADMIN', 'SECRETARY'), async (req, res) => {
  try {
    const { full_name, national_id, phone, course_id } = req.body;

    if (!full_name || !course_id) {
      return res.status(400).json({
        error: 'full_name and course_id are required',
      });
    }

    const course = await get(
      'SELECT course_id, fee_amount FROM courses WHERE school_id = ? AND course_id = ? AND active = 1',
      [req.user.school_id, course_id]
    );

    if (!course) {
      return res.status(400).json({ error: 'Invalid or inactive course_id' });
    }

    const student_id = newId();
    await run(
      'INSERT INTO students (student_id, school_id, branch_id, full_name, national_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [student_id, req.user.school_id, req.user.branch_id || null, full_name, national_id || null, phone || null]
    );

    const school = await get('SELECT code FROM schools WHERE school_id = ?', [req.user.school_id]);
    const admissionNumber = await generateAdmissionNumber({
      school_id: req.user.school_id,
      prefix: (school?.code || 'SCH').toUpperCase(),
    });

    const admission_id = newId();
    await run(
      `INSERT INTO admissions (
        admission_id,
        school_id,
        branch_id,
        student_id,
        admission_number,
        course_id,
        fee_amount_snapshot,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'UNPAID')`,
      [
        admission_id,
        req.user.school_id,
        req.user.branch_id || null,
        student_id,
        admissionNumber,
        course.course_id,
        course.fee_amount,
      ]
    );

    const admission = await get(
      `SELECT
         a.admission_id,
         a.admission_number,
         a.fee_amount_snapshot,
         a.status,
         s.full_name,
         s.phone,
         c.course_name
       FROM admissions a
       JOIN students s ON s.student_id = a.student_id
       JOIN courses c ON c.course_id = a.course_id
       WHERE a.school_id = ? AND a.admission_id = ?`,
      [req.user.school_id, admission_id]
    );

    res.status(201).json({
      admission,
      payment_instructions: {
        paybill: process.env.PAYBILL_NUMBER || 'YOUR_PAYBILL',
        account_reference: admission.admission_number,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create admission' });
  }
});

// Helper to compute fee summary for an admission number
async function computeFeeSummary({ school_id, branch_id, admissionNumber }) {
  const admission = await get(
    `SELECT
       a.admission_number,
       a.branch_id,
       a.fee_amount_snapshot,
       a.status,
       s.full_name,
       s.phone,
       c.course_name
     FROM admissions a
     JOIN students s ON s.student_id = a.student_id
     JOIN courses c ON c.course_id = a.course_id
     WHERE a.school_id = ? AND a.admission_number = ?`,
    [school_id, admissionNumber]
  );

  if (!admission) {
    return null;
  }
  if (branch_id && admission.branch_id && admission.branch_id !== branch_id) {
    return null;
  }

  const payments = await get(
    'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE school_id = ? AND admission_number = ?',
    [school_id, admissionNumber]
  );

  const totalFee = Number(admission.fee_amount_snapshot || 0);
  const totalPaid = Number(payments?.total_paid || 0);
  const balance = totalFee - totalPaid;

  let status = 'UNPAID';
  if (totalPaid === 0) {
    status = 'UNPAID';
  } else if (totalPaid > 0 && totalPaid < totalFee) {
    status = 'PARTIAL';
  } else if (totalPaid === totalFee) {
    status = 'CLEARED';
  } else if (totalPaid > totalFee) {
    status = 'OVERPAID';
  }

  return {
    admission_number: admission.admission_number,
    full_name: admission.full_name,
    phone: admission.phone,
    course_name: admission.course_name,
    total_fee: totalFee,
    total_paid: totalPaid,
    balance,
    status,
  };
}

async function upsertAdmissionStatusFromLedger({ school_id, admissionNumber }) {
  const summary = await computeFeeSummary({ school_id, branch_id: null, admissionNumber });
  if (!summary) return null;
  await run('UPDATE admissions SET status = ? WHERE school_id = ? AND admission_number = ?', [
    summary.status,
    school_id,
    admissionNumber,
  ]);
  return summary;
}

async function recordPaymentForAdmission({
  school_id,
  branch_id,
  admission_number,
  amount,
  mpesa_receipt,
  payer_phone,
  payer_name,
  transaction_time,
  raw_payload,
}) {
  await run(
    `INSERT INTO payments (
      school_id,
      branch_id,
      admission_number,
      amount,
      mpesa_receipt,
      payer_phone,
      payer_name,
      transaction_time,
      raw_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      school_id,
      branch_id || null,
      admission_number,
      amount,
      mpesa_receipt,
      payer_phone || null,
      payer_name || null,
      transaction_time || null,
      raw_payload || null,
    ]
  );
}

async function recordUnmatchedPayment({
  school_id,
  branch_id,
  account_reference,
  amount,
  mpesa_receipt,
  payer_phone,
  payer_name,
  transaction_time,
  raw_payload,
}) {
  await run(
    `INSERT INTO unmatched_payments (
      school_id,
      branch_id,
      account_reference,
      amount,
      mpesa_receipt,
      payer_phone,
      payer_name,
      transaction_time,
      raw_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      school_id,
      branch_id || null,
      account_reference,
      amount,
      mpesa_receipt,
      payer_phone || null,
      payer_name || null,
      transaction_time || null,
      raw_payload || null,
    ]
  );
}

// Manual payment endpoint (non-M-Pesa testing)
app.post('/payments/manual', requireAuth, requireRole('SCHOOL_ADMIN', 'SECRETARY', 'CASHIER'), async (req, res) => {
  try {
    const {
      admission_number,
      amount,
      mpesa_receipt,
      payer_phone,
      payer_name,
      transaction_time,
    } = req.body;

    if (!admission_number || typeof amount !== 'number' || !mpesa_receipt) {
      return res.status(400).json({
        error: 'admission_number, numeric amount, and mpesa_receipt are required',
      });
    }

    const scope = getScopeFilter(req.user);
    const admission = await get(
      `SELECT school_id, branch_id, admission_number
       FROM admissions
       WHERE school_id = ? AND admission_number = ?`,
      [scope.school_id, admission_number]
    );

    if (!admission) {
      return res.status(400).json({ error: 'Invalid admission_number' });
    }
    if (scope.mode === 'branch' && admission.branch_id !== scope.branch_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      await recordPaymentForAdmission({
        school_id: admission.school_id,
        branch_id: admission.branch_id,
        admission_number,
        amount,
        mpesa_receipt,
        payer_phone,
        payer_name,
        transaction_time,
        raw_payload: null,
      });
    } catch (err) {
      if (err && err.message && err.message.includes('UNIQUE constraint failed: payments.mpesa_receipt')) {
        return res.status(409).json({ error: 'Duplicate mpesa_receipt' });
      }
      throw err;
    }

    const summary = await upsertAdmissionStatusFromLedger({
      school_id: admission.school_id,
      admissionNumber: admission_number,
    });

    res.status(201).json({
      message: 'Payment recorded',
      fee_summary: summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Daraja C2B validation URL (optional but recommended)
app.post('/mpesa/c2b/validation', async (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Daraja C2B confirmation URL (required)
app.post('/mpesa/c2b/confirmation', async (req, res) => {
  try {
    const body = req.body || {};
    const mpesa_receipt = body.TransID || body.transId || body.mpesaReceipt;
    const account_reference = body.BillRefNumber || body.accountReference || body.billRefNumber;
    const amount = parseDarajaAmount(body.TransAmount || body.amount);
    const payer_phone = body.MSISDN || body.msisdn || body.payerPhone;
    const payer_name = body.FirstName || body.payerName || null;
    const transaction_time = body.TransTime || body.transactionTime || null;

    if (!mpesa_receipt || !account_reference || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid confirmation payload' });
    }

    const raw_payload = stringifyPayload(body);

    const school_code = String(account_reference).split('-')[0]?.toUpperCase();
    const school = await get('SELECT school_id FROM schools WHERE code = ?', [school_code]);
    if (!school) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Unknown school code' });
    }

    const admission = await get(
      'SELECT school_id, branch_id, admission_number FROM admissions WHERE school_id = ? AND admission_number = ?',
      [school.school_id, account_reference]
    );

    if (!admission) {
      try {
        await recordUnmatchedPayment({
          school_id: school.school_id,
          branch_id: null,
          account_reference,
          amount,
          mpesa_receipt,
          payer_phone,
          payer_name,
          transaction_time,
          raw_payload,
        });
      } catch (err) {
        if (err && err.message && err.message.includes('UNIQUE constraint failed: unmatched_payments.mpesa_receipt')) {
          return res.json({ ResultCode: 0, ResultDesc: 'Duplicate receipt (unmatched)' });
        }
        throw err;
      }
      return res.json({ ResultCode: 0, ResultDesc: 'Recorded (unmatched account reference)' });
    }

    try {
      await recordPaymentForAdmission({
        school_id: admission.school_id,
        branch_id: admission.branch_id,
        admission_number: account_reference,
        amount,
        mpesa_receipt,
        payer_phone,
        payer_name,
        transaction_time,
        raw_payload,
      });
    } catch (err) {
      if (err && err.message && err.message.includes('UNIQUE constraint failed: payments.mpesa_receipt')) {
        return res.json({ ResultCode: 0, ResultDesc: 'Duplicate receipt' });
      }
      throw err;
    }

    await upsertAdmissionStatusFromLedger({ school_id: admission.school_id, admissionNumber: account_reference });
    res.json({ ResultCode: 0, ResultDesc: 'Recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Failed to record' });
  }
});

// List unmatched payments (admin reconciliation)
app.get('/payments/unmatched', requireAuth, requireRole('SCHOOL_ADMIN', 'SECRETARY', 'CASHIER'), async (req, res) => {
  try {
    const scope = getScopeFilter(req.user);
    const where = scope.mode === 'branch' ? 'school_id = ? AND branch_id = ?' : 'school_id = ?';
    const params = scope.mode === 'branch' ? [scope.school_id, scope.branch_id] : [scope.school_id];
    const rows = await all(
      `SELECT
         unmatched_payment_id,
         school_id,
         branch_id,
         account_reference,
         amount,
         mpesa_receipt,
         payer_phone,
         payer_name,
         transaction_time,
         created_at
       FROM unmatched_payments
       WHERE ${where}
       ORDER BY created_at DESC`
      , params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list unmatched payments' });
  }
});

// Fee summary endpoint
app.get('/admissions/:admission_number/fee-summary', requireAuth, async (req, res) => {
  try {
    const { admission_number } = req.params;
    const scope = getScopeFilter(req.user);
    const summary = await computeFeeSummary({
      school_id: scope.school_id,
      branch_id: scope.branch_id,
      admissionNumber: admission_number,
    });

    if (!summary) {
      return res.status(404).json({ error: 'Admission not found' });
    }

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch fee summary' });
  }
});

// Exam eligibility endpoint (eligible iff fees CLEARED)
app.get('/admissions/:admission_number/exam-eligibility', requireAuth, async (req, res) => {
  try {
    const { admission_number } = req.params;
    const scope = getScopeFilter(req.user);
    const summary = await computeFeeSummary({
      school_id: scope.school_id,
      branch_id: scope.branch_id,
      admissionNumber: admission_number,
    });
    if (!summary) return res.status(404).json({ error: 'Admission not found' });

    res.json({
      admission_number,
      eligible: summary.status === 'CLEARED',
      fee_summary: summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute exam eligibility' });
  }
});

// Register student for exam (blocked unless CLEARED)
app.post('/exam-registrations', requireAuth, requireRole('SCHOOL_ADMIN', 'SECRETARY'), async (req, res) => {
  try {
    const { admission_number, exam_date } = req.body;
    if (!admission_number || !exam_date) {
      return res.status(400).json({ error: 'admission_number and exam_date are required' });
    }

    const scope = getScopeFilter(req.user);
    const summary = await computeFeeSummary({
      school_id: scope.school_id,
      branch_id: scope.branch_id,
      admissionNumber: admission_number,
    });
    if (!summary) return res.status(404).json({ error: 'Admission not found' });
    if (summary.status !== 'CLEARED') {
      return res.status(409).json({
        error: 'Fees not cleared',
        fee_summary: summary,
      });
    }

    const exam_registration_id = newId();
    await run(
      `INSERT INTO exam_registrations (exam_registration_id, school_id, branch_id, admission_number, exam_date, status)
       VALUES (?, ?, ?, ?, ?, 'REGISTERED')`,
      [exam_registration_id, scope.school_id, scope.branch_id || null, admission_number, exam_date]
    );

    const row = await get(
      `SELECT exam_registration_id, admission_number, exam_date, status, created_at
       FROM exam_registrations
       WHERE exam_registration_id = ?`,
      [exam_registration_id]
    );

    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create exam registration' });
  }
});

module.exports = app;

// Local/dev: run as a normal server.
// Vercel: imports the app as a Serverless Function (no listen()).
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  server.on('error', (err) => {
    console.error('Server failed to start:', err);
  });
}

