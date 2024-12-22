const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();



const fetchMyTasks = async (req, res) => {
  const userId = req.user.id; // Ensure user ID is extracted from the authenticated user

  try {
    // Fetch tasks assigned to the user
    const assignedTasks = await prisma.task.findMany({
      where: {
        taskAssignees: {
          some: {
            assigneeId: userId, // Check if the user is an assignee
          },
        },
      },
      include: {
        taskAssignees: {
          include: {
            assignee: true, // Include assignee details
          },
        },
      },
    });

    // Fetch tasks created/assigned by the user
    const createdTasks = await prisma.task.findMany({
      where: {
        createdBy: userId, // Ensure you track the `createdBy` field in your schema
      },
      include: {
        taskAssignees: {
          include: {
            assignee: true,
          },
        },
      },
    });

    res.status(200).json({
      assignedToMe: assignedTasks,
      assignedByMe: createdTasks,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks." });
  }
};




/**
 * Fetch detailed information for a specific task
 */


const fetchTaskDetails = async (req, res) => {
  try {
      const { taskId } = req.params;

      // Fetch the task details
      const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: {
              taskAssignees: {
                  include: {
                      assignee: {
                          select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                              phoneNumber: true,
                          },
                      },
                  },
              },
              trashBagIssuances: {
                  include: {
                      customer: {
                          select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                              phoneNumber: true,
                          },
                      },
                  },
              },
          },
      });

      if (!task) {
          return res.status(404).json({ message: "Task not found" });
      }

      // Format the response
      const response = {
          taskDetails: {
              taskId: task.id,
              type: task.type,
              status: task.status,
              declaredBags: task.declaredBags,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
          },
          assignees: task.taskAssignees.map((assignee) => ({
              assigneeId: assignee.assignee.id,
              name: `${assignee.assignee.firstName} ${assignee.assignee.lastName}`,
              phoneNumber: assignee.assignee.phoneNumber,
          })),
          customers: task.trashBagIssuances.map((issuance) => ({
              customerId: issuance.customer.id,
              name: `${issuance.customer.firstName} ${issuance.customer.lastName}`,
              phoneNumber: issuance.customer.phoneNumber,
              bagsIssued: issuance.bagsIssued, // Include bagsIssued status
          })),
      };

      res.status(200).json(response);
  } catch (error) {
      console.error("Error fetching task details:", error);
      res.status(500).json({
          message: "Failed to fetch task details",
          error: error.message,
      });
  }
};



module.exports = {
    fetchMyTasks,
    fetchTaskDetails,
};
