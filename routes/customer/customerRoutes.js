// routes/customerRoutes.js
const express = require('express');
const { verifyToken } = require('../../middleware/verifyToken.js');
const { createCustomer } = require('../../controller/customers/createCustomer.js');
const { getAllCustomers } = require('../../controller/customers/getAllCustomers.js');
const { editCustomer } = require('../../controller/customers/editCustomer.js');
const { SearchCustomers } = require('../../controller/customers/searchCustomers.js');
const checkAccess = require('../../middleware/roleVerify.js');



const router = express.Router();

// Route to create a new customer
router.post('/customers',verifyToken,checkAccess('Customer','create') , createCustomer);
router.get('/customers', verifyToken ,checkAccess('Customer','read'), getAllCustomers);
router.put('/customers/:id',verifyToken,checkAccess('Customer','update'), editCustomer);
router.get('/search-customers',verifyToken,checkAccess('Customer','read'), SearchCustomers);

module.exports = router;

