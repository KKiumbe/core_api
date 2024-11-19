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

module.exports = {
  getAllUsers,
  assignRole,
  deleteUser,
  stripRoles,
};
