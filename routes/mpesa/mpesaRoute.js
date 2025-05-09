const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { lipaNaMpesa } = require('../../controller/mpesa/payment.js');
const prisma = new PrismaClient();
const { settleInvoice } = require('../../controller/mpesa/paymentSettlement.js');
const { sendsms } = require('../../controller/sms/smsController.js');
const axios = require('axios');

router.post('/callback', async (req, res) => {
 
    const paymentData = req.body;

    if (!paymentData) {
        return res.status(400).json({ message: 'No payment data received' });
    }

    // Parse paymentInfo for local processing with defaults for undefined fields
    const paymentInfo = {
        TransID: paymentData.TransID || '',
        TransTime: parseTransTime(paymentData.TransTime),
        TransAmount: parseFloat(paymentData.TransAmount) || 0,
        ref: paymentData.BillRefNumber || '',
        phone: paymentData.MSISDN || '',
        FirstName: paymentData.FirstName || '',
    };

    console.log('Payment Notification Received:', paymentInfo);

    try {
        const existingTransaction = await prisma.mpesaTransaction.findUnique({
            where: { TransID: paymentInfo.TransID },
        });

        if (existingTransaction) {
            console.log(`Transaction with ID ${paymentInfo.TransID} already exists. Skipping save.`);
            return res.status(409).json({ message: 'Transaction already processed.', transactionId: paymentInfo.TransID });
        }

        const transaction = await prisma.mpesaTransaction.create({
            data: {
                TransID: paymentInfo.TransID,
                TransTime: paymentInfo.TransTime,
                TransAmount: paymentInfo.TransAmount,
                BillRefNumber: paymentInfo.ref,
                MSISDN: paymentInfo.phone,
                FirstName: paymentInfo.FirstName,
                processed: false,
            },
        });

        console.log('Payment info saved to the database:', transaction);


        await settleInvoice();

        const message = `Hello ${paymentInfo.FirstName || 'Customer'}, we have received your payment of KES ${paymentInfo.TransAmount}. Thank you for your payment!`;
        const smsResponses = await sendsms(paymentInfo.ref || 'unknown', message);

        console.log('SMS sent:', smsResponses);

        res.status(200).json({ message: 'Payment processed successfully.' });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ message: 'Error processing payment.', error: error.message });
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