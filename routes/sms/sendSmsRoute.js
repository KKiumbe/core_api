const express = require('express');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');
const { sendBills, sendToAll, sendBill, sendBillPerDay, sendToGroup,  sendToOne } = require('../../controller/sms/smsController.js');





const router = express.Router();

// SMS Routes
router.post('/send-bills', verifyToken, checkAccess('Customer', 'read'), sendBills);
router.post('/send-to-all', verifyToken, checkAccess('Customer', 'read'), sendToAll);
router.post('/send-bill', verifyToken, checkAccess('Customer', 'read'), sendBill);
router.post('/send-bill-perday', verifyToken, checkAccess('Customer', 'read'), sendBillPerDay);
router.post('/send-to-group', verifyToken, checkAccess('Customer', 'read'), sendToGroup);
router.post('/send-sms', verifyToken, checkAccess('Customer', 'read'), sendToOne );
//router.post('/auto-sms' , sendSMS)

module.exports = router;
