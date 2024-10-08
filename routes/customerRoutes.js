// routes/customerRoutes.js
const express = require('express');
const { createCustomer } = require('../controller/createCustomer.js');
const { getAllCustomers } = require('../controller/getAllCustomers.js');
const { editCustomer } = require('../controller/editCustomer.js');
const { SearchCustomers } = require('../controller/searchCustomers.js');
const { verifyToken } = require('../middleware/verifyToken.js');


const router = express.Router();

// Route to create a new customer
router.post('/customers',verifyToken, createCustomer);
router.get('/customers', getAllCustomers);
router.put('/customers/:id',verifyToken, editCustomer);
router.get('/search-customers', SearchCustomers);

module.exports = router;

