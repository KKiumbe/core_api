const express = require('express');
const { getReceipts, getReceiptById } = require('../../controller/receipting/getReceipt.js');
const { MpesaPaymentSettlement } = require('../../controller/receipting/MpesaPaymentSettlement.js');
const { manualCashPayment } = require('../../controller/receipting/manualReceipting.js');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');

const router = express.Router();

router.post('/manual-receipt', MpesaPaymentSettlement);
router.post('/manual-cash-payment', manualCashPayment);

router.get('/receipts' , verifyToken,checkAccess('Receipt','read'),getReceipts );

router.get('/receipts/:id', verifyToken,checkAccess('Receipt','read') ,getReceiptById);


module.exports = router;


