const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { lipaNaMpesa } = require('../../controller/mpesa/payment.js');
const prisma = new PrismaClient();
const { settleInvoice } = require('../../controller/mpesa/paymentSettlement.js');
const { sendsms } = require('../../controller/sms/smsController.js');
const axios = require('axios');

router.post('/callback', async (req, res) => {
    // Check if this is a forwarded request
    const isForwarded = req.headers['x-forwarded-request'] === 'true';
    
    const paymentData = req.body;

    if (!paymentData) {
        return res.status(400).json({ message: 'No payment data received' });
    }

    const paymentInfo = {
        TransID: paymentData.TransID,
        TransTime: parseTransTime(paymentData.TransTime),
        TransAmount: parseFloat(paymentData.TransAmount),
        ref: paymentData.BillRefNumber,
        phone: paymentData.MSISDN,
        FirstName: paymentData.FirstName,
    };

    console.log('Payment Notification Received:', paymentInfo);

    try {
        // Check if the transaction already exists
        const existingTransaction = await prisma.mpesaTransaction.findUnique({
            where: { TransID: paymentInfo.TransID },
        });

        if (existingTransaction) {
            console.log(`Transaction with ID ${paymentInfo.TransID} already exists. Skipping save.`);
            return res.status(409).json({ message: 'Transaction already processed.', transactionId: paymentInfo.TransID });
        }

        // Save the payment transaction to the database
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

        // Forward payment data to the same URL only if not already forwarded
        if (!isForwarded) {
            const targetUrl = 'https://taqa.co.ke/api/callback'; // Use the exact case as provided
            try {
                const response = await axios.post(targetUrl, paymentInfo, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Forwarded-Request': 'true', // Mark as forwarded
                    },
                    timeout: 5000,
                });
                console.log('Payment data forwarded successfully:', response.data);
            } catch (forwardError) {
                console.error('Error forwarding payment data:', forwardError.message);
                // Continue processing even if forwarding fails
            }
        } else {
            console.log('Forwarded request detected, skipping further forwarding.');
        }

        // Trigger invoice settlement process
        await settleInvoice();

        const message = `Hello ${paymentInfo.FirstName}, we have received your payment of KES ${paymentInfo.TransAmount}. Thank you for your payment!`;
        const smsResponses = await sendsms(paymentInfo?.ref, message);

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
    const year = parseInt(transTime.slice(0, 4), 10);
    const month = parseInt(transTime.slice(4, 6), 10) - 1;
    const day = parseInt(transTime.slice(6, 8), 10);
    const hours = parseInt(transTime.slice(8, 10), 10);
    const minutes = parseInt(transTime.slice(10, 12), 10);
    const seconds = parseInt(transTime.slice(12, 14), 10);
    
    return new Date(year, month, day, hours, minutes, seconds);
}

router.post('/lipa', lipaNaMpesa);

module.exports = router;