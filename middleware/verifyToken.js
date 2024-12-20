const jwt = require('jsonwebtoken');

const { PrismaClient } = require('@prisma/client'); // Import PrismaClient

const prisma = new PrismaClient(); 

const verifyToken = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Not Authenticated" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }

    try {
      // Fetch user and permissions from the database
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        include: { permissions: true }, // Include the user's permissions
      });

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Attach user info and permissions to the request object
      req.user = {
        id: user.id,
        roles: user.roles,
        permissions: user.permissions, // Include permissions
      };

      next(); // Pass control to the next middleware/route
    } catch (dbError) {
      console.error("Database error in verifyToken:", dbError.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
};

module.exports = { verifyToken };
