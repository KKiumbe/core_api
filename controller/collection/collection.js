const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const cron = require("node-cron");

// Scheduled job to reset all customers' collected status every Monday at midnight
cron.schedule("0 0 * * 1", async () => {
  try {
    const customers = await prisma.customer.findMany({
      where: { collected: true }, // Find all customers whose garbage was collected
    });

    // Insert collection history for all customers marked as collected
    await prisma.garbageCollectionHistory.createMany({
      data: customers.map((customer) => ({
        customerId: customer.id,
        collected: true,
        collectionDate: new Date(),
      })),
    });

    // Reset collected status for all customers
    await prisma.customer.updateMany({
      data: {
        collected: false,
      },
    });

    console.log("Reset all customers' collected status for the new week.");
  } catch (error) {
    console.error("Error resetting collected status:", error);
  }
});

// Fetch collections for a specific day
const getCollections = async (req, res) => {
  try {
    const { day } = req.query; // Expecting 'day' as a query parameter (e.g., MONDAY)

    const customers = await prisma.customer.findMany({
      where: {
        status: "ACTIVE",
        garbageCollectionDay: day ? day.toUpperCase() : undefined,
      },
    });

    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Error fetching customers." });
  }
};

// Mark a customer as collected and update their history
const markCollected = async (req, res) => {
  const { customerId } = req.params;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found." });
    }

    // Update the collected status
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        collected: true, // Mark as collected
      },
    });

    // Add entry to garbage collection history
    await prisma.garbageCollectionHistory.create({
      data: {
        customerId: customerId,
        collected: true,
        collectionDate: new Date(),
      },
    });

    res.json({
      message: "Customer marked as collected.",
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Error marking customer as collected:", error);
    res.status(500).json({ error: "Error marking customer as collected." });
  }
};

// Filter collections for a specific day
const filterCollections = async (req, res) => {
  const { day } = req.query; // Expecting 'day' as a query parameter (e.g., MONDAY)

  try {
    const customers = await prisma.customer.findMany({
      where: {
        status: "ACTIVE",
        garbageCollectionDay: day ? day.toUpperCase() : undefined,
      },
    });

    res.json(customers);
  } catch (error) {
    console.error("Error filtering customers:", error);
    res.status(500).json({ error: "Error filtering customers." });
  }
};

module.exports = {
  getCollections,
  markCollected,
  filterCollections,
};
