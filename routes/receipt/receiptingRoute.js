const express = require('express');
const { getReceipts, getReceiptById } = require('../../controller/receipting/getReceipt.js');
const { manualCashPayment } = require('../../controller/receipting/manualCashPayment.js');

const router = express.Router();

router.post('/manual-receipt', manualCashPayment);
router.post('/manual-cash-payment', manualCashPayment);

router.get('/receipts',getReceipts );

router.get('/receipts/:id', getReceiptById);


module.exports = router;


