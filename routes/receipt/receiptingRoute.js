const express = require('express');
const { manualReceipt } = require('../../controller/receipting/manualReceipting.js');
const { getReceipts, getReceiptById } = require('../../controller/receipting/getReceipt.js');

const router = express.Router();

router.post('/manual-receipt', manualReceipt);

router.get('/receipts',getReceipts );

router.get('/receipts/:id', getReceiptById);


module.exports = router;


