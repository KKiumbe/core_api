const express = require('express');
const router = express.Router();
const axios = require('axios');
// const { generateAccessToken } = require('./mpesaMiddleware'); // Adjust the path as needed

// // Your M-Pesa credentials
// const lipaNaMpesaOnlineShortcode = process.env.MPESA_SHORTCODE; // Lipa Na M-Pesa shortcode
// const baseUrl = 'https://sandbox.safaricom.co.ke'; // Change to live URL for production

// // Route to receive M-Pesa payment notifications
router.post('/callback', async (req, res) => {
    const paymentData = req.body; // M-Pesa sends the payment details in the body

    // Handle the payment notification (e.g., save to database, send confirmation, etc.)
    console.log('Payment Notification Received:', paymentData);
    
    // Send a response back to M-Pesa
    res.status(200).send('Notification received'); // Respond with 200 OK to M-Pesa
});

// Route to check transaction status with the token middleware
// router.get('/transaction-status/:transactionId', generateAccessToken, async (req, res) => {
//     const transactionId = req.params.transactionId;

//     try {
//         const response = await axios.get(`${baseUrl}/mpesa/transactionstatus/v1/query`, {
//             headers: {
//                 Authorization: `Bearer ${req.accessToken}`, // Use the token from the request object
//             },
//             params: {
//                 Shortcode: lipaNaMpesaOnlineShortcode,
//                 TransactionID: transactionId,
//                 // Include other necessary parameters required by the API
//             },
//         });

        // Return the response from M-Pesa
//         res.status(200).json(response.data);
//     } catch (error) {
//         console.error('Error fetching transaction status:', error);
//         res.status(500).json({ error: 'Error fetching transaction status' });
//     }
// });

module.exports = router;
