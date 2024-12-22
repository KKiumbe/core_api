// routes/customerRoutes.js
const express = require('express');
const { register, signin } = require('../../controller/auth/signupSignIn.js');
const { requestOTP, verifyOTP, resetPassword } = require('../../controller/auth/resetPassword.js');



const router = express.Router();

// Route to create a new customer
router.post('/signup', register);
router.post('/signin', signin);

router.post('/request-otp', requestOTP);

router.post('/verify-otp', verifyOTP);

router.post('/password-reset', resetPassword);







module.exports = router;
