const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const issueBagsToCustomers = async (req, res) => {
  const { taskId, customerBags } = req.body; // customerBags is an array of customerId and bags to be issued

  // Validate input
  if (!taskId || !Array.isArray(customerBags) || customerBags.length === 0) {
    return res.status(400).json({
      error: "Invalid input. Provide a valid taskId and a list of customers with the number of bags.",
    });
  }

  try {
    // Fetch the task to ensure it exists and get the assignee (collector)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assigneeId: true, status: true },
    });

    if (!task || task.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Task is not in progress or does not exist." });
    }

    // Fetch the assignee (collector) to check their stock
    const assignee = await prisma.user.findUnique({
      where: { id: task.assigneeId },
      select: { bagsHeld: true },
    });

    if (!assignee) {
      return res.status(400).json({ error: "Assignee (collector) not found." });
    }

    // Calculate the total number of bags to issue
    const totalBagsToIssue = customerBags.reduce((acc, customer) => acc + customer.numberOfBags, 0);

    // Check if the assignee has enough bags in stock to fulfill the issuance
    if (assignee.bagsHeld < totalBagsToIssue) {
      return res.status(400).json({
        error: `Not enough bags in stock. Assignee only has ${assignee.bagsHeld} bags available.`,
      });
    }

    // Begin issuing bags to customers
    const issuancePromises = customerBags.map(async (customer) => {
      // Check if the customer has already received 4 bags this month
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

      const totalBagsIssuedThisMonth = await prisma.trashBagIssuance.aggregate({
        where: {
          customerId: customer.customerId,
          issuedDate: {
            gte: currentMonthStart,
            lt: currentMonthEnd,
          },
        },
        _sum: {
          bagsIssued: true, // Track how many bags have been issued to this customer this month
        },
      });

      const totalIssued = totalBagsIssuedThisMonth._sum.bagsIssued || 0;

      // Ensure no customer receives more than 4 bags in a month
      if (totalIssued >= 4) {
        throw new Error(`Customer ${customer.customerId} has already received 4 bags this month.`);
      }

      // Ensure the number of bags issued doesn't exceed 4
      const remainingBags = 4 - totalIssued;
      const bagsToIssue = Math.min(customer.numberOfBags, remainingBags);

      // Find the trash bag issuance record for the customer
      const trashBagIssuanceRecord = await prisma.trashBagIssuance.findFirst({
        where: { taskId: taskId, customerId: customer.customerId },
      });

      if (!trashBagIssuanceRecord) {
        throw new Error(`No trash bag issuance record found for customer ${customer.customerId}`);
      }

      // Update the TrashBagIssuance table for this customer
      return prisma.trashBagIssuance.update({
        where: {
          id: trashBagIssuanceRecord.id,
        },
        data: {
          bagsIssued: true, // Mark the bags as issued
          customerId: customer.customerId, // Track which customer received the bags
        },
      });
    });

    // Wait for all bag issuance updates to complete
    await Promise.all(issuancePromises);

    // Update the assignee's stock of bags
    await prisma.user.update({
      where: { id: assignee.id },
      data: {
        bagsHeld: assignee.bagsHeld - totalBagsToIssue, // Decrease the bags held by the assignee
      },
    });

    res.status(200).json({
      message: `Bags successfully issued to customers.`,
      remainingStock: assignee.bagsHeld - totalBagsToIssue, // Return the updated stock of bags for the assignee
    });
  } catch (error) {
    console.error("Error issuing bags to customers:", error);
    res.status(500).json({ error: error.message || "Error issuing bags to customers." });
  }
};

module.exports = {
  issueBagsToCustomers,
};
