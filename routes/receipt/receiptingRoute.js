const express = require('express');
const { manualReceipt } = require('../../controller/receipting/manualReceipting.js');
const { getReceipts } = require('../../controller/receipting/getReceipt.js');

const router = express.Router();

router.post('/manual-receipt', manualReceipt);

router.get('/receipts',getReceipts );


module.exports = router;


