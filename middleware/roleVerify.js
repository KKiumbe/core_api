const ROLE_PERMISSIONS = require("../DatabaseConfig/role.js");

const checkAccess = (module, action) => (req, res, next) => {
  // Ensure req.user exists
  const user = req.user;
  console.log(`user ${user}`);

  if (!user) {
    console.error("User object is missing from the request. Ensure authentication middleware is applied.");
    return res.status(403).json({
      error: "Unauthorized",
      details: "User is not authenticated. Please log in.",
    });
  }

  // Extract roles from user object
  const { roles } = user;

  console.log("Authenticated user:", user);

  // Ensure roles is a non-empty array
  if (!Array.isArray(roles) || roles.length === 0) {
    console.warn("Invalid or missing roles for the user.");
    return res.status(403).json({
      error: "Forbidden",
      details: "No valid roles provided. Please log in or check your permissions.",
    });
  }

  console.log(`Checking access for module "${module}", action "${action}", roles: ${JSON.stringify(roles)}`);

  // Check if the user has the required permission
  const hasPermission = roles.some((role) =>
    ROLE_PERMISSIONS[role]?.[module]?.includes(action)
  );

  if (hasPermission) {
    console.log(`Access granted for roles "${roles.join(", ")}" on ${module}:${action}`);
    return next();
  }

  console.error(`Access denied: User lacks permission for ${module}:${action}`);
  return res.status(403).json({
    error: "Forbidden",
    details: `You lack the "${action}" permission for "${module}". Please contact an administrator.`,
  });
};

module.exports = checkAccess;
