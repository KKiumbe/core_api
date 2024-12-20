const { PrismaClient } = require('@prisma/client');
const ROLE_PERMISSIONS = require('./../../DatabaseConfig/role.js'); // Adjust the path to your ROLE_PERMISSIONS file
const prisma = new PrismaClient();

const checkAuthorization = async (req, res) => {
  try {
    const { resource, action } = req.query;

    const {user} = res.user;

    // Log the authenticated user object
    console.log(`Authenticated user from res: ${user}`);

    // Validate input
    if (!resource || !action) {
      return res.status(400).json({
        error: "Both 'resource' and 'action' parameters are required.",
        example: "/check-authorization?resource=Customer&action=read",
      });
    }

    // Validate the user and permissions from res.user
    if (!user || !user.roles) {
      return res.status(403).json({
        error: "User not authenticated or missing roles.",
      });
    }

    const { roles } = res.user;

    console.log(`Checking access for module "${resource}", action "${action}", roles: ${JSON.stringify(roles)}`);

    // Check permissions for each role
    let hasPermission = false;

    for (const role of roles) {
      const permissionsForRole = ROLE_PERMISSIONS[role] || {};

      // Check if the resource exists in the role's permissions
      const allowedActions = permissionsForRole[resource] || [];
      if (allowedActions.includes(action)) {
        hasPermission = true;
        break; // Exit early if permission is found
      }
    }

    if (hasPermission) {
      console.log(`Access granted for ${action}:${resource}`);
    } else {
      console.log(`Access denied: User lacks permission for ${action}:${resource}`);
    }

    return res.json({
      authorized: hasPermission,
      requiredPermission: `${action}:${resource}`,
    });
  } catch (error) {
    console.error("Error in checkAuthorization:", error.message);
    return res.status(500).json({
      error: "Internal server error while checking authorization.",
    });
  }
};

module.exports = { checkAuthorization };
