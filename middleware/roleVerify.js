const ROLE_PERMISSIONS = require("../DatabaseConfig/role.js");

const checkAccess = (module, action) => (req, res, next) => {
  try {
    // Ensure req.user exists
    const user = req.user;
    if (!user) {
      console.error("Authentication failed: req.user is missing.");
      return res.status(403).json({
        error: "Unauthorized",
        details: "User is not authenticated. Please log in.",
      });
    }

    // Extract roles from the user object
    const { roles } = user;
    if (!Array.isArray(roles) || roles.length === 0) {
      console.warn("Authorization failed: User has no valid roles.");
      return res.status(403).json({
        error: "Forbidden",
        details: "User has no valid roles. Access denied.",
      });
    }

    console.log(`Authenticated user: ${JSON.stringify(user)}`);
    console.log(`Checking access for module "${module}", action "${action}", roles: ${JSON.stringify(roles)}`);

    // Check if the user has the required permission
    const hasPermission = roles.some((role) =>
      ROLE_PERMISSIONS[role]?.[module]?.includes(action)
    );

    if (hasPermission) {
      console.log(`Access granted for roles "${roles.join(", ")}" on ${module}:${action}`);
      return next(); // User has the required permission
    }

    console.error(`Access denied: User lacks permission for ${module}:${action}`);
    return res.status(403).json({
      error: "Forbidden",
      details: `You lack the "${action}" permission for "${module}". Please contact an administrator.`,
    });
  } catch (error) {
    console.error("An error occurred in checkAccess:", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
      details: "An unexpected error occurred while checking access.",
    });
  }
};

module.exports = checkAccess;
