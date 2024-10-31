const  express = require ('express');

const { sendHighBalanceCustomers, sendLowBalanceCustomers, sendUnpaidCustomers } = require ('../../controller/bulkSMS/dashboardSMS.js');

const router = express.Router();

// Route to send SMS to all customers


router.post('/send-sms-unpaid' ,sendUnpaidCustomers)

// Route to send SMS to low balance customers
router.post('/send-sms-low-balance', sendLowBalanceCustomers);

// Route to send SMS to high balance customers
router.post('/send-sms-high-balance', sendHighBalanceCustomers);

// Export the router to use in your main app
module.exports = router;


