const express = require('express');
const { manualReceipt } = require('../../controller/receipting/manualReceipting.js');

const router = express.Router();

router.post('/manual-receipt', manualReceipt);


module.exports = router;


