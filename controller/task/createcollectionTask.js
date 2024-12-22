const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const createTaskForIssuingTrashBags = async (req, res) => {
  const { assigneeId, collectionDay, declaredBags } = req.body; // Single assigneeId and number of declared bags
  const userId = req.user.id; // Fetching the ID of the user making the request

  // Validate inputs
  if (!assigneeId || declaredBags <= 0) {
    return res.status(400).json({
      error: "Invalid input. Provide a valid assignee and a valid number of declared bags.",
    });
  }

  try {
    // Validate that the provided user has the `collector` role (or another relevant role for assignees)
    const assignee = await prisma.user.findUnique({
      where: {
        id: assigneeId,
      },
      select: {
        roles: true,
        bagsHeld: true, // Fetch the number of bags held by the assignee
      },
    });

    if (!assignee || !assignee.roles.includes("collector")) { // Or use another relevant role
      return res.status(400).json({ error: "The provided user does not have the required role." });
    }

    // Fetch customers based on filters
    const filters = {};
    if (collectionDay) filters.garbageCollectionDay = collectionDay.toUpperCase();

    const customers = await prisma.customer.findMany({
      where: {
        ...filters,
        status: "ACTIVE",
      },
    });

    if (customers.length === 0) {
      return res.status(404).json({ error: "No customers found for the given filters." });
    }

    // Create the task for issuing trash bags, declaring the number of bags
    const task = await prisma.task.create({
      data: {
        type: "Trash Bag Issuance", // Indicating this is a trash bag issuance task
        status: "PENDING", // Task is pending until the collector starts
        declaredBags: declaredBags, // Declaring the number of bags in the task
        createdBy: userId, // Track who created the task
      },
    });

    // Assign the task to the single assignee (employee)
    await prisma.taskAssignee.create({
      data: {
        assigneeId: assigneeId, // Assigning the task to a single assignee
        taskId: task.id,
      },
    });

    // Save all customers in the TrashBagIssuance table (they will be marked as not issued initially)
    const issuanceData = customers.map((customer) => ({
      taskId: task.id,
      customerId: customer.id,
      bagsIssued: false, // Initially, bags have not been issued
      issuedDate: new Date(),
    }));

    await prisma.trashBagIssuance.createMany({
      data: issuanceData,
    });

    // Create a notification for the collector
    const notificationMessage = `New task assigned: Trash Bag Issuance with ${declaredBags} bags.`;

    await prisma.notification.create({
      data: {
        message: notificationMessage,  // Task notification message
        userId: assigneeId,            // The collector will receive this notification
        status: "UNREAD",              // Set the status as UNREAD initially
      },
    });

    res.status(201).json({
      message: "Task created and assigned successfully.",
      task,
      customers, // Return the list of customers who are part of the task
      declaredBags, // Declare the number of bags for the task
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Error creating task." });
  }
};

module.exports = {
  createTaskForIssuingTrashBags,
};
