// routes/customerRoutes.js
const express = require('express');
const { verifyToken } = require('../../middleware/verifyToken.js');
const { createCustomer } = require('../../controller/customers/createCustomer.js');
const { getAllCustomers } = require('../../controller/customers/getAllCustomers.js');
const { editCustomer } = require('../../controller/customers/editCustomer.js');
const { SearchCustomers } = require('../../controller/customers/searchCustomers.js');



const router = express.Router();

// Route to create a new customer
router.post('/customers',verifyToken, createCustomer);
router.get('/customers', getAllCustomers);
router.put('/customers/:id',verifyToken, editCustomer);
router.get('/search-customers', SearchCustomers);

module.exports = router;

