const express = require('express');
const { verifyToken } = require('../../middleware/verifyToken.js');

const {checkAuthorization} = require('./../../controller/permission/permission.js')


const router = express.Router();

router.get('/check-permissions', checkAuthorization);

module.exports = router;
