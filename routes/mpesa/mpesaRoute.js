const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { lipaNaMpesa } = require('../../controller/mpesa/payment.js');
const prisma = new PrismaClient();
const { settleInvoice } = require('../../controller/mpesa/paymentSettlement.js');
const { sendsms } = require('../../controller/sms/smsController.js');
const axios = require('axios');




const forwardUrl = process.env.PAYMENT_FORWARD_URL; 


router.post('/callback', async (req, res) => {
  const paymentData = req.body;
  if (!paymentData) {
    return res.status(400).json({ message: 'No payment data received' });
  }

  // 1) Forward to external URL (fire-and-forget or await)
  try {
    const forwardResponse = await axios.post(forwardUrl, paymentData);
    console.log('Forwarded to external URL, status:', forwardResponse.status);
  } catch (err) {
    console.error('Failed to forward paymentData:', err.message);
    // optionally: return res.status(502).json({ message: 'Forwarding failed' });
  }

  // 2) Your existing parsing & DB logic
  const paymentInfo = {
    TransID:      paymentData.TransID     || '',
    TransTime:    parseTransTime(paymentData.TransTime),
    TransAmount:  parseFloat(paymentData.TransAmount) || 0,
    ref:          paymentData.BillRefNumber || '',
    phone:        paymentData.MSISDN      || '',
    FirstName:    paymentData.FirstName  || '',
  };
  console.log('Payment Notification Received:', paymentInfo);

  try {
    // ... Prisma lookup/create, settleInvoice(), send SMS, etc.
    const existing = await prisma.mpesaTransaction.findUnique({
      where: { TransID: paymentInfo.TransID }
    });
    if (existing) {
      return res.status(409).json({ message: 'Already processed' });
    }
    await prisma.mpesaTransaction.create({ data: {
      TransID: paymentInfo.TransID,
      TransTime: paymentInfo.TransTime,
      TransAmount: paymentInfo.TransAmount,
      BillRefNumber: paymentInfo.ref,
      MSISDN: paymentInfo.phone,
      FirstName: paymentInfo.FirstName,
      processed: false,
    }});
    await settleInvoice();
   // const msg = `Hello ${paymentInfo.FirstName}, received KES ${paymentInfo.TransAmount}. Thanks!`;
   // await sendsms(paymentInfo.ref, msg);

    res.status(200).json({ message: 'Payment processed successfully.' });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Error processing payment.' });
  } finally {
    await prisma.$disconnect();
  }
});



function parseTransTime(transTime) {
    if (!transTime || transTime.length !== 14) {
        console.warn('Invalid TransTime format, using current date:', transTime);
        return new Date();
    }
    const year = parseInt(transTime.slice(0, 4), 10);
    const month = parseInt(transTime.slice(4, 6), 10) - 1;
    const day = parseInt(transTime.slice(6, 8), 10);
    const hours = parseInt(transTime.slice(8, 10), 10);
    const minutes = parseInt(transTime.slice(10, 12), 10);
    const seconds = parseInt(transTime.slice(12, 14), 10);
    const date = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(date) ? new Date() : date;
}

router.post('/lipa', lipaNaMpesa);

module.exports = router;