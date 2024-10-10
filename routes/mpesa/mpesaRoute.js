const express = require('express');
const router = express.Router();

const { lipaNaMpesa } = require('../../controller/mpesa/payment.js');

router.post('/callback', async (req, res) => {
    const paymentData = req.body; // M-Pesa sends the payment details in the body

    if(!paymentData){
        res.json('ok')
    }

    // Handle the payment notification (e.g., save to database, send confirmation, etc.)
    console.log('Payment Notification Received:', paymentData.body);
    console.log(paymentData.Body.CallbackMetadata);
    
    // Send a response back to M-Pesa
    res.status(200).send('Notification received'); // Respond with 200 OK to M-Pesa
});


router.post('/lipa', lipaNaMpesa); // Use the controller function

module.exports = router;
