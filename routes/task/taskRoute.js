

const express = require('express');

const { createTaskForIssuingTrashBags } = require('../../controller/task/createcollectionTask.js');
const { getTaskDetails } = require('../../controller/task/getTaskDetails.js');
const { markCustomerAsIssued } = require('../../controller/task/maskBagsIssued.js');




const router = express.Router();

// Route to create a new customer
router.post('/create-trashbag-task', createTaskForIssuingTrashBags);

router.get('/trashbag-task/:taskId', getTaskDetails);

router.post('/trashbag-issed', markCustomerAsIssued);





module.exports = router;