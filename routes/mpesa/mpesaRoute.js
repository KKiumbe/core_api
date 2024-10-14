const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client'); // Ensure you have Prisma Client installed

const prisma = new PrismaClient();
const { lipaNaMpesa } = require('../../controller/mpesa/payment.js');

router.post('/callback', async (req, res) => {
    const paymentData = req.body; // M-Pesa sends the payment details in the body

    if (!paymentData) {
        return res.json('no payment');
    }

    const paymentInfo = {
        TransID: paymentData.TransID,
        TransTime: parseTransTime(paymentData.TransTime), // Parse the time here
        TransAmount: paymentData.TransAmount,
        ref: paymentData.BillRefNumber,
        phone: paymentData.MSISDN,
        FirstName: paymentData.FirstName
    };

    // Log the payment info
    console.log('Payment Notification Received:', paymentInfo);

    try {
        await prisma.mpesaTransaction.create({
            data: {
                TransID: paymentInfo.TransID,
                TransTime: paymentInfo.TransTime, // Ensure correct date format
                TransAmount: paymentInfo.TransAmount,
                BillRefNumber: paymentInfo.ref,
                MSISDN: paymentInfo.phone,
                FirstName: paymentInfo.FirstName,
            },
        });
        console.log('Payment info saved to the database.');
        res.status(200).json({ message: 'Payment recorded successfully.' });
    } catch (error) {
        console.error('Error saving payment info:', error);
        res.status(500).json({ error: 'Failed to save payment info.' });
    }
});

// Function to parse TransTime
function parseTransTime(transTime) {
    // Example format: '20241015013021' (YYYYMMDDHHMMSS)
    const year = parseInt(transTime.slice(0, 4), 10);
    const month = parseInt(transTime.slice(4, 6), 10) - 1; // Months are 0-indexed
    const day = parseInt(transTime.slice(6, 8), 10);
    const hours = parseInt(transTime.slice(8, 10), 10);
    const minutes = parseInt(transTime.slice(10, 12), 10);
    const seconds = parseInt(transTime.slice(12, 14), 10);
    
    return new Date(year, month, day, hours, minutes, seconds);
}

// Route to handle Lipa Na M-Pesa requests
router.post('/lipa', lipaNaMpesa); // Use the controller function

module.exports = router;
