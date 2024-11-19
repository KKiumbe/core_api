const ROLE_PERMISSIONS = require("./../DatabaseConfig/role.js");

const checkAccess = (module, action) => (req, res, next) => {
  const { user } = req; // Assume user info is added to req after authentication

  if (!user) return res.status(403).json({ error: "Unauthorized" });

  const { roles } = user;

  for (const role of roles) {
    if (ROLE_PERMISSIONS[role]?.[module]?.includes(action)) {
      return next();
    }
  }

  return res.status(403).json({ error: "Forbidden" });
};

module.exports = checkAccess;
