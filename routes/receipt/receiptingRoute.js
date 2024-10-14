const express = require('express');
const { receiptUser, getUnpaidInvoices, searchReceipts } = require('../../controller/receipting/receiptUser.js');

const router = express.Router();

router.post('/receipt-invoices', receiptUser);
router.get('/receipts', searchReceipts);
router.get('/receipt/unpaid-invoices/:customerID', getUnpaidInvoices);

module.exports = router;


