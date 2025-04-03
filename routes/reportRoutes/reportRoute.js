// routes/reportRoutes.js
const express = require('express');
const { getAllActiveCustomersReport } = require('../../controller/reports/customers/allCustomers.js');
const { downloadInvoice } = require('../../controller/reports/invoices/invoicePDFGen.js');
const {getCurrentCustomersDebt, getCustomersWithHighDebt, getCustomersWithLowBalance} = require('../../controller/reports/customers/debtReport.js');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');
const { ageAnalysisReport } = require('../../controller/reports/customers/ageAnalysis.js');
const { dormantCustomersReport } = require('../../controller/reports/customers/dormant.js');
const { getCustomerBalanceRangeReport, getCustomerMonthlyChargeRangeReport } = require('../../controller/reports/customers/closingBalanceRange.js');
const { getUnpaidInvoicesReport } = require('../../controller/reports/invoices/unpaid.js');
const { getInvoiceStatusSummaryReport } = require('../../controller/reports/invoices/invoicesSummary.js');
const { getAllPaymentsReport } = require('../../controller/reports/payments/allPayments.js');
const { getMpesaPaymentsReport } = require('../../controller/reports/payments/mpesa.js');
const { getCashPaymentsReport } = require('../../controller/reports/payments/cash.js');
const { getPaymentsByCustomerReport } = require('../../controller/reports/payments/paymentByCustomer.js');
const { getPaymentModeSummaryReport } = require('../../controller/reports/payments/paymentByModeSummary.js');
const { getGarbageCollectionHistoryReport } = require('../../controller/reports/garbageCollection/history.js');
const { getGarbageCollectionDaySummaryReport } = require('../../controller/reports/garbageCollection/summary.js');
const { getTrashBagsIssuanceReport } = require('../../controller/reports/garbageCollection/garbageBagIssuarance.js');
const router = express.Router();

// Define the route for the debt report
//customers
router.get('/all-customers', getAllActiveCustomersReport);
router.get('/customers-high-debt', getCustomersWithHighDebt);
router.get('/customers-low-debt', getCustomersWithLowBalance);


router.get('/dormant-customers', dormantCustomersReport);
router.get('/age-analysis/report', ageAnalysisReport);

 



router.get('/get-customers-monthlycharge-range', getCustomerMonthlyChargeRangeReport);

//invoicing

router.get('/unpaid-invoices', getUnpaidInvoicesReport);
router.get('/invoice-status-summary', getInvoiceStatusSummaryReport);


router.get('/download-invoice/:invoiceId', downloadInvoice);
router.get('/get-customers-balance-range', getCustomerBalanceRangeReport);

//payments


router.get('/all-payments', getAllPaymentsReport);
router.get('/mpesa-payments', getMpesaPaymentsReport);
router.get('/cash-payments', getCashPaymentsReport);
router.get('/payments-by-customer', getPaymentsByCustomerReport);
router.get('/payment-mode-summary', getPaymentModeSummaryReport);


//garbage collection 


router.get('/garbage-collection-history', getGarbageCollectionHistoryReport);
router.get('/garbage-collection-day-summary', getGarbageCollectionDaySummaryReport);
router.get('/trash-bags-issuance', getTrashBagsIssuanceReport);

module.exports = router;
