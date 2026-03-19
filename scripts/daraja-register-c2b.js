/* Registers Daraja C2B Validation/Confirmation URLs */

require('dotenv').config();

const { registerC2BUrls } = require('../src/daraja');

async function main() {
  const shortCode = process.env.DARAJA_SHORTCODE || process.env.PAYBILL_NUMBER;
  const confirmationUrl = process.env.DARAJA_CONFIRMATION_URL;
  const validationUrl = process.env.DARAJA_VALIDATION_URL;
  const responseType = process.env.DARAJA_RESPONSE_TYPE || 'Completed';

  if (!shortCode) throw new Error('Missing DARAJA_SHORTCODE (or PAYBILL_NUMBER)');
  if (!confirmationUrl) throw new Error('Missing DARAJA_CONFIRMATION_URL');
  if (!validationUrl) throw new Error('Missing DARAJA_VALIDATION_URL');

  const result = await registerC2BUrls({
    shortCode,
    confirmationUrl,
    validationUrl,
    responseType,
  });

  console.log('Daraja C2B URLs registered.');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

