// controller/customerController.js
const { PrismaClient } = require('@prisma/client'); // Import Prisma Client
const prisma = new PrismaClient(); // Create an instance of Prisma Client

// Get all customers
const getAllCustomers = async (req, res) => {
    try {
        const customers = await prisma.customer.findMany();
        res.status(200).json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


// Export both the create and getAll functions
module.exports = { getAllCustomers };
