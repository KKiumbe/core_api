const express = require('express');
const { fetchAllPayments, fetchPaymentById } = require('../../controller/payments/getAllPayments.js');

const router = express.Router();

router.get('/payments', fetchAllPayments);
router.get('/payments/:paymentId', fetchPaymentById);


module.exports = router;