const express = require('express');
const { upload, uploadCustomers } = require('../../controller/fileupload/uploadscript.js');

const router = express.Router();

// Route for uploading customer data
router.post('/upload-customers', upload.single('file'), uploadCustomers);

// Export the router to use in your main app
module.exports = router;
