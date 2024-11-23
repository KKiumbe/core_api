const { PrismaClient } = require('@prisma/client');

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
        roles: true,
        createdAt: true,
      },
    });

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users", details: error.message });
  }
};

/**
 * Assign roles to a user
 */
const assignRole = async (req, res) => {
  const { userId, roles } = req.body;

  if (!Array.isArray(roles)) {
    return res.status(400).json({ error: "Roles must be an array" });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { roles },
    });

    res.status(200).json({ message: "Roles assigned successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign roles", details: error.message });
  }
};

/**
 * Delete a user
 */
const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user", details: error.message });
  }
};

/**
 * Strip all roles from a user
 */
const stripRoles = async (req, res) => {
  const { userId } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { roles: [] }, // Clear the roles array
    });

    res.status(200).json({ message: "All roles stripped from user", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: "Failed to strip roles", details: error.message });
  }
};







// Route to edit the user information (role in this case)
const editUserRole = async (req, res) => {
  const { phoneNumber, role } = req.body; // Get phone number and new role from the request body

  try {
    // Check if the role is valid (optional, you can customize based on your needs)
    const validRoles = ['user', 'admin']; // Example of valid roles
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role provided.' });
    }

    // Find the user by phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    // If the user doesn't exist, return an error
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Update the user's role
    const updatedUser = await prisma.user.update({
      where: { phoneNumber },
      data: {
        roles: [role], // You can modify this to append the role if you want multiple roles
      },
    });

    res.status(200).json({ message: 'User role updated successfully', updatedUser });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



module.exports = {
  getAllUsers,
  assignRole,
  deleteUser,
  stripRoles,
  editUserRole
};
