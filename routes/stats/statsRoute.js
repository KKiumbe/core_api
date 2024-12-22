// routes/dashboard.js
const express = require('express');
const { getDashboardStats } = require('../../controller/dashboadstats/dashboard.js');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');
const router = express.Router();


router.get('/stats',verifyToken,checkAccess('Customer','read'), getDashboardStats);

module.exports = router;
