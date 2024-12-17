const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Not Authenticated" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }

    req.user = {
      id: payload.id,
      roles: payload.roles, // Extract roles directly from token payload
    };
    next();
  });
};

module.exports = { verifyToken };
