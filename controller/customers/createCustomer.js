const { PrismaClient, GarbageCollectionDay, CustomerStatus } = require('@prisma/client'); // Import necessary enums
const prisma = new PrismaClient();

// Create a new customer
const createCustomer = async (req, res) => {
    const { 
        firstName, 
        lastName, 
        email, 
        phoneNumber, 
        gender, 
        county, 
        town, 
        location, 
        estateName, 
        building, 
        houseNumber, 
        category, 
        monthlyCharge, 
        garbageCollectionDay, 
        collected, 
        closingBalance, 
        status 
    } = req.body;

    // Check if all required fields are provided
    if (!firstName || !lastName || !phoneNumber || !gender || !monthlyCharge || !garbageCollectionDay) {
        return res.status(400).json({ message: 'Required fields are missing.' });
    }

    // Validate the location format: "latitude,longitude"
    const locationPattern = /^-?\d+\.\d+,-?\d+\.\d+$/;
    if (location && !locationPattern.test(location)) {
        return res.status(400).json({ message: 'Invalid location format. Please use "latitude,longitude".' });
    }

    // Validate the garbage collection day is a valid enum value
    const validCollectionDays = Object.values(GarbageCollectionDay);
    if (!validCollectionDays.includes(garbageCollectionDay)) {
        return res.status(400).json({ message: 'Invalid garbage collection day.' });
    }

    try {
        // Check if the phone number already exists in the database
        const existingCustomer = await prisma.customer.findUnique({
            where: { phoneNumber },
        });

        if (existingCustomer) {
            return res.status(400).json({ message: 'Phone number already exists.' });
        }

        // Use the correct enum value for the status (e.g., "ACTIVE")
        const customer = await prisma.customer.create({
            data: {
                firstName,
                lastName,
                email,
                phoneNumber,
                gender,
                county,
                town,
                status: status || CustomerStatus.ACTIVE,  // Default to ACTIVE if status is not provided
                location,
                estateName,           // Optional field for estate name
                building,              // Optional field for building name
                houseNumber,           // Optional field for house number
                category,
                monthlyCharge,
                garbageCollectionDay,  // Enum value for garbage collection day
                collected: collected ?? false, // Default to false if not provided
                closingBalance: closingBalance ?? 0, // Default to 0 if not provided
            },
        });

        // Send a success response with the created customer data
        res.status(201).json(customer);
    } catch (error) {
        console.error('Error creating customer:', error);

        // Check for Prisma unique constraint violation (phone number)
        if (error.code === 'P2002' && error.meta && error.meta.target.includes('phoneNumber')) {
            return res.status(400).json({ message: 'Phone number must be unique.' });
        }

        // General error handling
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Export the function for use in other parts of the app
module.exports = { createCustomer };
