require('dotenv').config();

const express = require('express');

const {
  run,
  get,
  all,
  generateAdmissionNumber,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SCHOOL_CODE = process.env.SCHOOL_CODE || 'SCH';

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create a course
app.post('/courses', async (req, res) => {
  try {
    const { course_name, fee_amount, duration_months } = req.body;

    if (!course_name || typeof fee_amount !== 'number') {
      return res.status(400).json({
        error: 'course_name and numeric fee_amount are required',
      });
    }

    const result = await run(
      `INSERT INTO courses (course_name, fee_amount, duration_months, active)
       VALUES (?, ?, ?, 1)`,
      [course_name, fee_amount, duration_months || null]
    );

    const course = await get(
      'SELECT course_id, course_name, fee_amount, duration_months, active FROM courses WHERE course_id = ?',
      [result.lastID]
    );

    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// List active courses
app.get('/courses', async (req, res) => {
  try {
    const courses = await all(
      'SELECT course_id, course_name, fee_amount, duration_months, active FROM courses WHERE active = 1 ORDER BY course_name'
    );
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

// New student admission (enrollment)
app.post('/admissions', async (req, res) => {
  try {
    const { full_name, national_id, phone, course_id } = req.body;

    if (!full_name || !course_id) {
      return res.status(400).json({
        error: 'full_name and course_id are required',
      });
    }

    const course = await get(
      'SELECT course_id, fee_amount FROM courses WHERE course_id = ? AND active = 1',
      [course_id]
    );

    if (!course) {
      return res.status(400).json({ error: 'Invalid or inactive course_id' });
    }

    const studentResult = await run(
      'INSERT INTO students (full_name, national_id, phone) VALUES (?, ?, ?)',
      [full_name, national_id || null, phone || null]
    );

    const admissionNumber = await generateAdmissionNumber(SCHOOL_CODE);

    const admissionResult = await run(
      `INSERT INTO admissions (
        student_id,
        admission_number,
        course_id,
        fee_amount_snapshot,
        status
      ) VALUES (?, ?, ?, ?, 'UNPAID')`,
      [
        studentResult.lastID,
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
       WHERE a.admission_id = ?`,
      [admissionResult.lastID]
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
async function computeFeeSummary(admissionNumber) {
  const admission = await get(
    `SELECT
       a.admission_number,
       a.fee_amount_snapshot,
       a.status,
       s.full_name,
       s.phone,
       c.course_name
     FROM admissions a
     JOIN students s ON s.student_id = a.student_id
     JOIN courses c ON c.course_id = a.course_id
     WHERE a.admission_number = ?`,
    [admissionNumber]
  );

  if (!admission) {
    return null;
  }

  const payments = await get(
    'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE admission_number = ?',
    [admissionNumber]
  );

  const totalFee = admission.fee_amount_snapshot;
  const totalPaid = payments?.total_paid || 0;
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

// Manual payment endpoint (non-M-Pesa testing)
app.post('/payments/manual', async (req, res) => {
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

    const admission = await get(
      'SELECT admission_number FROM admissions WHERE admission_number = ?',
      [admission_number]
    );

    if (!admission) {
      return res.status(400).json({ error: 'Invalid admission_number' });
    }

    try {
      await run(
        `INSERT INTO payments (
          admission_number,
          amount,
          mpesa_receipt,
          payer_phone,
          payer_name,
          transaction_time,
          raw_payload
        ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [
          admission_number,
          amount,
          mpesa_receipt,
          payer_phone || null,
          payer_name || null,
          transaction_time || null,
        ]
      );
    } catch (err) {
      if (err && err.message && err.message.includes('UNIQUE constraint failed: payments.mpesa_receipt')) {
        return res.status(409).json({ error: 'Duplicate mpesa_receipt' });
      }
      throw err;
    }

    const summary = await computeFeeSummary(admission_number);

    // Optionally update stored status on admissions table to keep in sync
    if (summary) {
      await run('UPDATE admissions SET status = ? WHERE admission_number = ?', [
        summary.status,
        admission_number,
      ]);
    }

    res.status(201).json({
      message: 'Payment recorded',
      fee_summary: summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Fee summary endpoint
app.get('/admissions/:admission_number/fee-summary', async (req, res) => {
  try {
    const { admission_number } = req.params;
    const summary = await computeFeeSummary(admission_number);

    if (!summary) {
      return res.status(404).json({ error: 'Admission not found' });
    }

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch fee summary' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

