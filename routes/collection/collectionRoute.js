const express = require('express');
const { PrismaClient } = require('@prisma/client'); // Ensure you have Prisma Client installed
const router = express.Router();

const prisma = new PrismaClient();

// 1. Load All Customers with their Collection Status by Collection Day
router.get('/collections', async (req, res) => {
  try {
    const { day } = req.query; // Expecting 'day' as a query parameter (e.g., MONDAY)

    // Fetch customers with their details for the specified collection day
    const customers = await prisma.customer.findMany({
      where: {
        garbageCollectionDay: day ? day.toUpperCase() : undefined,
      },
    });

    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Error fetching customers.' });
  }
});

// 2. Mark Customer as Collected
router.patch('/collections/:customerId', async (req, res) => {
  const { customerId } = req.params;

  try {
    // Check if the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Mark the customer as collected
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        collected: true, // Set collected to true
      },
    });

    res.json({
      message: 'Customer marked as collected.',
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error('Error marking customer as collected:', error);
    res.status(500).json({ error: 'Error marking customer as collected.' });
  }
});

// 3. Filter Customers by Collection Day
router.get('/collections/filter', async (req, res) => {
  const { day } = req.query; // Expecting 'day' as a query parameter (e.g., MONDAY)

  try {
    // Fetch customers filtered by collection day
    const customers = await prisma.customer.findMany({
      where: {
        garbageCollectionDay: day ? day.toUpperCase() : undefined,
      },
    });

    res.json(customers);
  } catch (error) {
    console.error('Error filtering customers:', error);
    res.status(500).json({ error: 'Error filtering customers.' });
  }
});

module.exports = router;
