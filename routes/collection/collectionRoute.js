const express = require('express');
const { getCollections, markCollected, filterCollections } = require('../../controller/collection/collection.js');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');

const router = express.Router();

// Load All Customers with their Collection Status by Collection Day
router.get('/collections',verifyToken, checkAccess('Customer','read'), getCollections);

// Mark Customer as Collected
router.patch('/collections/:customerId', verifyToken, checkAccess('Customer','update'), markCollected);

// Filter Customers by Collection Day
router.get('/collections/filter',verifyToken, checkAccess('Customer','read'), filterCollections);

module.exports = router;
