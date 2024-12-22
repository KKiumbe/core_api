// routes/reportRoutes.js
const express = require('express');
const { getAllActiveCustomersReport } = require('../../controller/reports/allCustomers.js');
const { downloadInvoice } = require('../../controller/reports/invoicePDFGen.js');
const {getCurrentCustomersDebt, getCustomersWithHighDebt, getCustomersWithLowBalance} = require('../../controller/reports/debtReport.js');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');
const { ageAnalysisReport } = require('../../controller/reports/ageAnalysis.js');
const router = express.Router();

// Define the route for the debt report
router.get('/reports/customers-debt', getCurrentCustomersDebt);
router.get('/reports/customers', getAllActiveCustomersReport);
router.get('/reports/customers-debt-high', getCustomersWithHighDebt);
router.get('/reports/customers-debt-low', getCustomersWithLowBalance);

router.get('/age-analysis/report',verifyToken,checkAccess('Invoice','read'), ageAnalysisReport);






router.get('/download-invoice/:invoiceId', downloadInvoice);




module.exports = router;
