const express = require('express');
const { fetchAllPayments, fetchPaymentById, fetchPaymentsByTransactionId } = require('../../controller/payments/getAllPayments.js');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');

const router = express.Router();

router.get('/payments',verifyToken,checkAccess('Payment','read'), fetchAllPayments);
router.get('/payments/:paymentId',verifyToken,checkAccess('Payment','read'), fetchPaymentById);
router.get('/payments-search',verifyToken,checkAccess('Payment','read'), fetchPaymentsByTransactionId);


module.exports = router;