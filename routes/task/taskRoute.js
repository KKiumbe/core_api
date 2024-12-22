

const express = require('express');

const { createTaskForIssuingTrashBags } = require('../../controller/task/createcollectionTask.js');
const { getTaskDetails, fetchMyTasks, fetchTaskDetails } = require('../../controller/task/getTaskDetails.js');
const { markCustomerAsIssued } = require('../../controller/task/maskBagsIssued.js');
const { verifyToken } = require('../../middleware/verifyToken.js');
const checkAccess = require('../../middleware/roleVerify.js');




const router = express.Router();

// Route to create a new customer
router.post('/create-trashbag-task', verifyToken, checkAccess('TrashBagTask', 'create'),  createTaskForIssuingTrashBags);

router.get('/fetch-task/',verifyToken, checkAccess('TrashBagTask', 'read'), fetchMyTasks);

router.get('/fetch-task-details/:taskId',verifyToken, checkAccess('TrashBagTask', 'read'), fetchTaskDetails);


router.post('/trashbag-issed',verifyToken, checkAccess('TrashBagTask', 'update'), markCustomerAsIssued);





module.exports = router;