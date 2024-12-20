const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const markCustomerAsIssued = async (req, res) => {
  const { taskId, customerId } = req.body; // taskId and customerId are sent in the request body

  if (!taskId || !customerId) {
    return res.status(400).json({ error: "taskId and customerId are required." });
  }

  try {
    // Check if the task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    // Check if the customer is part of the task
    const customer = await prisma.trashBagIssuance.findFirst({
      where: {
        taskId: taskId,
        customerId: customerId,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found for this task." });
    }

    // If the customer has already received the bags, return an error
    if (customer.bagsIssued) {
      return res.status(400).json({ error: "Customer has already been marked as issued." });
    }

    // Update the customer to mark them as issued
    await prisma.trashBagIssuance.update({
      where: {
        id: customer.id,
      },
      data: {
        bagsIssued: true, // Mark the customer as issued
        issuedDate: new Date(), // Set the date when bags are issued
      },
    });

    res.status(200).json({
      message: "Customer marked as issued successfully.",
      customerId: customerId,
    });
  } catch (error) {
    console.error("Error marking customer as issued:", error);
    res.status(500).json({ error: "Error marking customer as issued." });
  }
};

module.exports = {
  markCustomerAsIssued,
};
