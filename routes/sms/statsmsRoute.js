const  express = require ('express');
const { sendUnpaidCustomers, sendLowBalanceCustomers, sendHighBalanceCustomers } = require('../../controller/bulkSMS/dashboardSMS.js');
const { updateSmsDeliveryStatus, getSmsMessages, } = require('../../controller/bulkSMS/deliveryStatus.js');


const router = express.Router();

// Route to send SMS to all customers


router.post('/send-sms-unpaid' ,sendUnpaidCustomers);

// Route to send SMS to low balance customers
router.post('/send-sms-low-balance', sendLowBalanceCustomers);

// Route to send SMS to high balance customers
router.post('/send-sms-high-balance', sendHighBalanceCustomers);

router.get('/sms-delivery-report' ,updateSmsDeliveryStatus);
router.get('/sms-history',getSmsMessages);

// Export the router to use in your main app
module.exports = router;


