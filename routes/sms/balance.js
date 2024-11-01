const express = require('express');
const axios = require('axios');
const router = express.Router();

const SMS_BALANCE_URL = process.env.SMS_BALANCE_URL;
const apiKey = process.env.SMS_API_KEY;
const partnerID = process.env.PARTNER_ID;

// Endpoint to fetch SMS balance
router.get('/get-sms-balance', async (req, res) => {
  try {
    const response = await axios.post(SMS_BALANCE_URL, {
      apikey: apiKey,
      partnerID: partnerID
    });

    // Send back the balance data
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching SMS balance:', error);
    res.status(500).json({ error: 'Failed to fetch SMS balance' });
  }
});

module.exports = router;
