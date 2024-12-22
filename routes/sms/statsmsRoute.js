const  express = require ('express');
const { sendUnpaidCustomers, sendLowBalanceCustomers, sendHighBalanceCustomers } = require('../../controller/bulkSMS/dashboardSMS.js');
const { updateSmsDeliveryStatus, getSmsMessages, } = require('../../controller/bulkSMS/deliveryStatus.js');
const { verify } = require('jsonwebtoken');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');


const router = express.Router();

// Route to send SMS to all customers


router.post('/send-sms-unpaid' , verifyToken,checkAccess('Sms','create'), sendUnpaidCustomers);

// Route to send SMS to low balance customers
router.post('/send-sms-low-balance',verifyToken,checkAccess('Sms','create'), sendLowBalanceCustomers);

// Route to send SMS to high balance customers
router.post('/send-sms-high-balance',verifyToken,checkAccess('Sms','create'), sendHighBalanceCustomers);

router.get('/sms-delivery-report' ,updateSmsDeliveryStatus);
router.get('/sms-history',verifyToken,checkAccess('Sms','read') ,getSmsMessages);

// Export the router to use in your main app
module.exports = router;


