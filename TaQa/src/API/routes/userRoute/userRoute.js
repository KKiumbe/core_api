// routes/customerRoutes.js
const express = require('express');
const { register, signin } = require('../../controller/auth/signupSignIn.js');



const router = express.Router();

// Route to create a new customer
router.post('/signup', register);
router.post('/signin', signin);


module.exports = router;
