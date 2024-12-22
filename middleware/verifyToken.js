const jwt = require('jsonwebtoken');

const { PrismaClient } = require('@prisma/client'); // Import PrismaClient

const prisma = new PrismaClient(); 

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token; // Retrieve the token from cookies

  if (!token) {
    return res.status(401).json({ message: 'Not Authenticated' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    try {
      // Find user in the database
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Attach user info to req
      req.user = { id: user.id, roles: user.roles };
      next();
    } catch (dbError) {
      console.error('Database error in verifyToken:', dbError.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
};

module.exports = { verifyToken };

module.exports = { verifyToken };
