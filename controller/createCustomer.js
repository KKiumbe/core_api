const { PrismaClient, GarbageCollectionDay } = require('@prisma/client'); // Import the enum
const prisma = new PrismaClient();

// Create a new customer
const createCustomer = async (req, res) => {
    const { firstName, lastName, email, phoneNumber, gender, county, town, location, category, monthlyCharge, garbageCollectionDay, collected } = req.body;

    // Check if all required fields are provided
    if (!firstName || !lastName || !phoneNumber || !gender || !monthlyCharge || !garbageCollectionDay) {
        return res.status(400).json({ message: 'Required fields are missing.' });
    }

    // Validate the location format: "latitude,longitude"
    const locationPattern = /^-?\d+\.\d+,-?\d+\.\d+$/;
    if (location && !locationPattern.test(location)) {
        return res.status(400).json({ message: 'Invalid location format. Please use "latitude,longitude".' });
    }

    // Validate the garbage collection day
    const validCollectionDays = Object.values(GarbageCollectionDay);
    if (!validCollectionDays.includes(garbageCollectionDay)) {
        return res.status(400).json({ message: 'Invalid garbage collection day.' });
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
                location,
                category,
                monthlyCharge,
                garbageCollectionDay, // Enum value for garbage collection day
                collected,  // Set to false if not provided
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
