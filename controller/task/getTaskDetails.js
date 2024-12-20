const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getTaskDetails = async (req, res) => {
  const { taskId } = req.params; // Get the taskId from the URL parameter

  try {
    // Fetch task details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        type: true,
        status: true,
        declaredBags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    // Fetch customers assigned to this task from TrashBagIssuance table
    const customers = await prisma.trashBagIssuance.findMany({
      where: { taskId: taskId },
      select: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
      },
    });

    // Format customer data
    const customerList = customers.map((cust) => ({
      customerId: cust.customer.id,
      name: `${cust.customer.firstName} ${cust.customer.lastName}`,
      phoneNumber: cust.customer.phoneNumber,
    }));

    // Return task details and the list of customers
    res.status(200).json({
      taskDetails: {
        taskId: task.id,
        type: task.type,
        status: task.status,
        declaredBags: task.declaredBags,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
      customers: customerList, // List of customers under the task
    });
  } catch (error) {
    console.error("Error fetching task details:", error);
    res.status(500).json({ error: "Error fetching task details." });
  }
};

module.exports = {
  getTaskDetails,
};
