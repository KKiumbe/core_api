const express = require("express");
const checkAccess = require("../../middleware/roleVerify.js");
const { getAllUsers, assignRole, deleteUser, stripRoles, editUserRole, updateUserDetails, getUserById } = require("../../controller/userManagement/userManagement.js");
const { verifyToken } = require("../../middleware/verifyToken.js");


const router = express.Router();

// View all users (Super Admin only)
router.get("/users",verifyToken, checkAccess("User", "read"), getAllUsers);

router.get("/users/:userId",verifyToken, checkAccess("User", "read"), getUserById);
//router.put("/edit-role" , editUserRole)

// Assign roles to a user 
router.post("/assign-roles", verifyToken, checkAccess("User", "update"), assignRole);

router.put("/update-user", verifyToken, checkAccess("User", "update"), updateUserDetails);

// Delete a user
router.delete("/user/:userId",verifyToken, checkAccess("User", "delete"), deleteUser);

// Strip all roles from a user
router.post("/user/strip-roles",verifyToken, checkAccess("User", "update"), stripRoles);

module.exports = router;
