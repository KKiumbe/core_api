const express = require('express');
const { getReceipts, getReceiptById } = require('../../controller/receipting/getReceipt.js');
const { MpesaPaymentSettlement } = require('../../controller/receipting/MpesaPaymentSettlement.js');
const { manualCashPayment } = require('../../controller/receipting/manualReceipting.js');

const router = express.Router();

router.post('/manual-receipt', MpesaPaymentSettlement);
router.post('/manual-cash-payment', manualCashPayment);

router.get('/receipts',getReceipts );

router.get('/receipts/:id', getReceiptById);


module.exports = router;


