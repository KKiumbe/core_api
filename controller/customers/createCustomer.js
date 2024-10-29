const { PrismaClient, GarbageCollectionDay } = require('@prisma/client'); // Import the enum
const prisma = new PrismaClient();

// Create a new customer
const createCustomer = async (req, res) => {
    const { firstName, lastName, email, phoneNumber, gender, county, town, location, estateName, building, houseNumber, category, monthlyCharge, garbageCollectionDay, collected, closingBalance } = req.body;

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
        // Check if phone number already exists
        const existingCustomer = await prisma.customer.findUnique({
            where: { phoneNumber },
        });

        if (existingCustomer) {
            return res.status(400).json({ message: 'Phone number already exists.' });
        }

        // Create the customer if the phone number is unique
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
                estateName,           // Optional field for estate name
                building,              // Optional field for building name
                houseNumber,           // Optional field for house number
                category,
                monthlyCharge,
                garbageCollectionDay,  // Enum value for garbage collection day
                collected: collected ?? false, // Set collected to false if not provided
                closingBalance: closingBalance ?? 0, // Set closingBalance to 0 if not provided
            },
        });

        res.status(201).json(customer); // Respond with the created customer data
    } catch (error) {
        console.error('Error creating customer:', error);

        if (error.code === 'P2002' && error.meta && error.meta.target.includes('phoneNumber')) {
            return res.status(400).json({ message: 'Phone number must be unique.' });
        }

        res.status(500).json({ message: 'Internal server error' });
    }
};

// Export the function
module.exports = { createCustomer };
