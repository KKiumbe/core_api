const express = require('express');
const { verifyToken } = require('../../middleware/verifyToken.js');
const { getAllInvoices, generateInvoices, cancelSystemGeneratedInvoices, getInvoiceById, cancelInvoiceById, createInvoice, getInvoiceDetails } = require('../../controller/bill/billGenerator.js');
const { SearchInvoices } = require('../../controller/bill/searchInvoice.js');

const router = express.Router();




router.get('/invoices/all',verifyToken, getAllInvoices );

router.get('/invoices/search',verifyToken, SearchInvoices)
router.get('/invoices/:id/',verifyToken, getInvoiceDetails)
router.patch('/invoices/:id/cancel', verifyToken, cancelInvoiceById);

// Route to create a manual invoice
router.post('/invoices', verifyToken,createInvoice);

// Route to generate invoices for all active customers for a specified month
router.post('/invoices/generate', verifyToken,generateInvoices);



// Route to cancel system-generated invoices for a specific customer and month
router.patch('/invoices/cancel', cancelSystemGeneratedInvoices);


module.exports = router;
