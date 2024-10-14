const express = require('express');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

const { lipaNaMpesa } = require('../../controller/mpesa/payment.js');

// Callback route for M-Pesa payment notifications
router.post('/callback', async (req, res) => {
    const paymentData = req.body; // M-Pesa sends the payment details in the body

    // Check if paymentData is present
    if (!paymentData || Object.keys(paymentData).length === 0) {
        return res.status(400).json({ message: 'No payment data received' });
    }

    const paymentInfo = {
        TransID: paymentData.TransID,
        TransTime: paymentData.TransTime,
        TransAmount: paymentData.TransAmount,
        BillRefNumber: paymentData.BillRefNumber,
        MSISDN: paymentData.MSISDN,
        FirstName: paymentData.FirstName,
    };

    // Log the payment info
    console.log('Payment Notification Received:', paymentInfo);

    try {
        // Save payment info to the database
        await prisma.mpesaTransaction.create({
            data: {
                TransID: paymentInfo.TransID,
                TransTime: new Date(paymentInfo.TransTime), // Ensure correct date format
                TransAmount: paymentInfo.TransAmount,
                BillRefNumber: paymentInfo.BillRefNumber,
                MSISDN: paymentInfo.MSISDN,
                FirstName: paymentInfo.FirstName,
            },
        });
        console.log('Payment info saved to the database.');
        return res.status(200).json({ message: 'Payment info saved successfully' });

    } catch (error) {
        console.error('Error saving payment info:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to handle Lipa Na M-Pesa requests
router.post('/lipa', lipaNaMpesa); // Use the controller function

module.exports = router;
