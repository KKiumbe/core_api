const ROLE_PERMISSIONS = require("./../DatabaseConfig/role.js");

const checkAccess = (module, action) => (req, res, next) => {
  const { roles } = req.user; // Assume user info is added to req after authentication

  if (!roles) return res.status(403).json({ error: "Unauthorized" });

 
  console.log(`this is the roles object ${roles}`);

  for (const role of roles) {
    if (ROLE_PERMISSIONS[role]?.[module]?.includes(action)) {
      return next();
    }
  }

  return res.status(403).json({ error: "Forbidden" });
};

module.exports = checkAccess;
