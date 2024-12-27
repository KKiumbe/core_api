const { PrismaClient } = require("@prisma/client");
const { sendSMS } = require("../sms/smsController");


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
    const customerIssuance = await prisma.trashBagIssuance.findFirst({
      where: {
        taskId: taskId,
        customerId: customerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!customerIssuance) {
      return res.status(404).json({ error: "Customer not found for this task." });
    }

    // If the customer has already received the bags, return an error
    if (customerIssuance.bagsIssued) {
      return res.status(400).json({ error: "Customer has already been marked as issued." });
    }

    // Update the customer to mark them as issued
    await prisma.trashBagIssuance.update({
      where: {
        id: customerIssuance.id,
      },
      data: {
        bagsIssued: true, // Mark the customer as issued
        issuedDate: new Date(), // Set the date when bags are issued
      },
    });

    // Prepare SMS message
    const customer = customerIssuance.customer;
    const mobile = customer.phoneNumber;
    const message = `Dear ${customer.firstName}, you have been issued with 4 trash bags for month of december. Thank you for your cooperation!`;

    // Send SMS notification
    try {
      await sendSMS(message, mobile);
      console.log(`SMS sent to customer ${customer.phoneNumber}`);
    } catch (smsError) {
      console.error(`Error sending SMS to customer ${customer.phoneNumber}:`, smsError.message);
      // Optionally, you can log the SMS failure or handle it as required
    }

    res.status(200).json({
      message: "Customer marked as issued successfully and SMS sent.",
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
