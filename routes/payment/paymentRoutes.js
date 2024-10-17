const express = require('express');
const { fetchAllPayments } = require('../../controller/payments/getAllPayments.js');

const router = express.Router();

router.use('/payments', fetchAllPayments);

module.exports = router;