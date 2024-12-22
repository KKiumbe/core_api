const { PrismaClient } = require('@prisma/client');
const ROLE_PERMISSIONS = require('./../../DatabaseConfig/role.js');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

/**
 * Get all users
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber:true,
        roles: true,
        createdAt: true,
      },
    });

    if (!users.length) {
      return res.status(404).json({ message: 'No users found.' });
    }

    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
};


const getUserById = async (req, res) => {
  const { userId:id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber:true,
        email: true,
        roles: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: `User with ID ${id} not found.` });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(`Error fetching user with ID ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch user', details: error.message });
  }
};


/**
 * Assign roles to a user
 */


const assignRole = async (req, res) => {
  const { id: userId, roles } = req.body; // `roles` is an array of roles to assign
  const { roles: requesterRoles } = req.user; // `req.user` comes from authentication middleware

  // Check if the requester has admin privileges
  if (!requesterRoles.includes('admin')) {
    return res.status(403).json({ error: 'Access denied. Only admins can assign roles.' });
  }

  // Validate inputs
  if (!userId || !Array.isArray(roles)) {
    return res.status(400).json({ error: 'Invalid input. Ensure userId and roles are provided correctly.' });
  }

  // Ensure the admin role cannot be assigned by non-superadmin
  if (roles.includes('admin')) {
    return res.status(403).json({
      error: 'Access denied. The admin role cannot be assigned.',
    });
  }

  // Validate roles
  const validRoles = Object.keys(ROLE_PERMISSIONS); // Valid roles from the mapping
  const invalidRoles = roles.filter((r) => !validRoles.includes(r));

  if (invalidRoles.length > 0) {
    return res.status(400).json({
      error: 'Invalid roles provided.',
      details: invalidRoles,
    });
  }

  try {
    // Check if user exists
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Calculate permissions based on roles
    let permissions = [];

    roles.forEach((role) => {
      const rolePermissions = ROLE_PERMISSIONS[role];
      if (rolePermissions) {
        Object.keys(rolePermissions).forEach((resource) => {
          rolePermissions[resource].forEach((action) => {
            permissions.push(`${action}:${resource}`);
          });
        });
      }
    });

    // Remove duplicate permissions
    permissions = [...new Set(permissions)];

    // Ensure permissions exist in the database, create missing ones
    const createdPermissions = [];
    for (const perm of permissions) {
      let permission = await prisma.permission.findUnique({
        where: { name: perm },
      });

      if (!permission) {
        permission = await prisma.permission.create({
          data: { name: perm },
        });
      }

      createdPermissions.push(permission);
    }

    // Update the user's roles and permissions
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          set: roles, // Replace existing roles with the provided array
        },
        permissions: {
          connect: createdPermissions.map((perm) => ({ id: perm.id })), // Connect existing permissions
        },
      },
    });

    return res.status(200).json({
      message: 'Roles and permissions assigned successfully.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Failed to assign roles and permissions:', error.message);
    return res.status(500).json({
      error: 'Failed to assign roles and permissions.',
      details: error.message,
    });
  }
};


/**
 * Update user details
 */
const updateUserDetails = async (req, res) => {
  const {
    userId,
    firstName,
    lastName,
    email,
    phoneNumber,
    gender,
    county,
    town,
    password,
  } = req.body;
  
  const { roles: requesterRoles } = req.user; // Assuming `req.user.roles` is an array

  // Check if requester has 'admin' role
  if (!requesterRoles.includes('admin')) {
    return res.status(403).json({ error: 'Access denied. Only admins can update user details.' });
  }

  // Ensure userId is provided
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  // Prepare the update data
  const updateData = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (email) updateData.email = email;
  if (phoneNumber) updateData.phoneNumber = phoneNumber;
  if (gender) updateData.gender = gender;
  if (county) updateData.county = county;
  if (town) updateData.town = town;
  if (password) updateData.password = await bcrypt.hash(password, 10);

  try {
    // Check if user exists
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update user details
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.status(200).json({ message: 'User details updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Failed to update user details:', error.message);
    res.status(500).json({ error: 'Failed to update user details', details: error.message });
  }
};

/**
 * Delete a user
 */
const deleteUser = async (req, res) => {
  const { userId } = req.params;
  const { roles: requesterRole, id: requesterId } = req.user;

  
  if (userId === requesterId) {
    return res.status(403).json({ error: 'You cannot delete your own account.' });
  }

  if (!requesterRole.includes('admin')) {
    return res.status(403).json({ error: 'Access denied. Only admins can update user details.' });
  }

  try {
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete user:', error.message);
    res.status(500).json({ error: 'Failed to delete user.', details: error.message });
  }
};

/**
 * Strip roles from a user
 */
const stripRoles = async (req, res) => {
  const { userId } = req.body;
  const { id: requesterId, roles: requesterRoles } = req.user; // Ensure roles is an array

  // Check if user is trying to strip their own roles
  if (requesterId === userId) {
    return res.status(400).json({ error: 'You cannot strip your own roles.' });
  }

  // Ensure requester has 'admin' role
  if (!requesterRoles.includes('admin')) {
    return res.status(403).json({ error: 'Access denied. Only admins can strip roles.' });
  }

  try {
    // Ensure that user exists before stripping roles
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Strip all roles from the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { roles: [] }, // Assuming roles is an array
    });

    return res.status(200).json({
      message: 'All roles stripped from user.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Failed to strip roles:', error.message);
    return res.status(500).json({
      error: 'Failed to strip roles.',
      details: error.message,
    });
  }
};


module.exports = {
  getAllUsers,
  assignRole,
  deleteUser,
  stripRoles,
  updateUserDetails,
  getUserById
};
