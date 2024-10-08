const { PrismaClient } = require('@prisma/client'); // Import Prisma Client
const prisma = new PrismaClient(); // Create an instance of Prisma Client

const SearchCustomers = async (req, res) => {
    const { phone, name } = req.query;

    try {
        // Initialize the query object
        let query = {
            where: {},
        };

        // If phone is provided, filter by exact match
        if (phone) {
            const uniqueCustomer = await prisma.customer.findMany({
                where: {
                    phoneNumber: phone, // Exact match for phone
                },
            });

            // If a customer is found, return it; otherwise return null
            return res.json(uniqueCustomer.length ? uniqueCustomer : null);
        }

        // If name is provided, filter by first name or last name
        if (name) {
            query = {
                where: {
                    OR: [
                        {
                            firstName: {
                                contains: name, // Use 'contains' for pattern matching
                                mode: 'insensitive', // Case insensitive
                            },
                        },
                        {
                            lastName: {
                                contains: name, // Use 'contains' for pattern matching
                                mode: 'insensitive', // Case insensitive
                            },
                        },
                    ],
                },
            };
        }

        // Fetch customers based on the built query
        const customers = await prisma.customer.findMany(query);
        res.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ message: 'Error fetching customers' });
    }
};

module.exports = { SearchCustomers };
