
const express = require('express');
const { getCustomerDetails } = require('../../controller/customers/customerDetails.js');

const router = express.Router();

// Route to get customer details with invoices, payments, and receipts
router.get('/customer-details/:id', getCustomerDetails);

module.exports = router;
