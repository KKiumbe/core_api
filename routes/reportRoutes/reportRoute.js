// routes/reportRoutes.js
const express = require('express');
const { getCustomersWithDebtReport } = require('../../controller/reports/debtReport.js');
const { getAllActiveCustomersReport } = require('../../controller/reports/allCustomers.js');
const router = express.Router();

// Define the route for the debt report
router.get('/reports/customers-debt', getCustomersWithDebtReport);
router.get('/reports/customers', getAllActiveCustomersReport);



router.get('/download-invoice/:invoiceId', downloadInvoice);




module.exports = router;
