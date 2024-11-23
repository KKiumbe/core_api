const express = require("express");
const checkAccess = require("../../middleware/roleVerify.js");
const { getAllUsers, assignRole, deleteUser, stripRoles, editUserRole } = require("../../controller/userManagement/userManagement.js");
const { verifyToken } = require("../../middleware/verifyToken.js");


const router = express.Router();

// View all users (Super Admin only)
router.get("/users", checkAccess("users", "read"), getAllUsers);
router.put("/edit-role" , editUserRole)

// Assign roles to a user
router.post("/assign-roles", verifyToken, checkAccess("users", "update"), assignRole);

// Delete a user
router.delete("/user/:userId",verifyToken, checkAccess("users", "delete"), deleteUser);

// Strip all roles from a user
router.post("/user/strip-roles",verifyToken, checkAccess("users", "update"), stripRoles);

module.exports = router;
