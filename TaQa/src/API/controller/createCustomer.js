// controller/createCustomer.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create a new customer
const createCustomer = async (req, res) => {
    const { firstName, lastName, email, phoneNumber, gender, county, town, location, category, monthlyCharge } = req.body;

    // Check if all required fields are provided
    if (!firstName || !lastName || !phoneNumber || !gender || !monthlyCharge) {
        return res.status(400).json({ message: 'Required fields are missing.' });
    }

    // Validate the location format: "latitude,longitude"
    const locationPattern = /^-?\d+\.\d+,-?\d+\.\d+$/; // Regex to validate location
    if (location && !locationPattern.test(location)) {
        return res.status(400).json({ message: 'Invalid location format. Please use "latitude,longitude".' });
    }

    try {
        const customer = await prisma.customer.create({
            data: {
                firstName,
                lastName,
                email,
                phoneNumber,
                gender,
                county,
                town,
                location, // Ensure this is defined
                category,
                monthlyCharge
            },
        });

        res.status(201).json(customer); // Respond with the created customer data
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Export the function
module.exports = { createCustomer };
