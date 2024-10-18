const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Controller function to fetch all receipts
const getReceipts = async (req, res) => {
    try {
        // Fetch all receipts with their associated payment, customer, and closing balance
        const receipts = await prisma.receipt.findMany({
            include: {
                payment: true, // Include payment details
                customer: {    // Include customer details
                    select: {
                        name: true,
                        phoneNumber: true,
                        closingBalance: true, // Include the closing balance from the customer
                    },
                },
                receiptInvoices: {
                    include: {
                        invoice: true, // Include invoice details for each receipt
                    },
                },
            },
            orderBy: {
                id: 'desc', // Order receipts by ID in descending order
            },
        });

        // Check if receipts were found
        if (!receipts.length) {
            return res.status(404).json({ message: 'No receipts found.' });
        }

        // Format the receipts to include createdAt timestamp
        const formattedReceipts = receipts.map((receipt) => ({
            ...receipt,
            createdAt: receipt.createdAt.toISOString(), // Format createdAt for better readability
            customer: {
                ...receipt.customer,
                closingBalance: receipt.customer?.closingBalance || 0, // Ensure closingBalance is present
            },
        }));

        res.status(200).json(formattedReceipts);
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({ error: 'Failed to fetch receipts.' });
    }
};

// Controller function to fetch a receipt by its ID
const getReceiptById = async (req, res) => {
    const { id } = req.params; // Extract receipt ID from the route parameters

    try {
        // Fetch the receipt with the specified ID, including related payment, customer, and closing balance
        const receipt = await prisma.receipt.findUnique({
            where: {
                id: parseInt(id), // Match the receipt by ID (ensure ID is an integer)
            },
            include: {
                payment: true, // Include payment details
                customer: {    // Include customer details
                    select: {
                        name: true,
                        phoneNumber: true,
                        closingBalance: true, // Include the closing balance from the customer
                    },
                },
                receiptInvoices: {
                    include: {
                        invoice: true, // Include invoice details for each receipt
                    },
                },
            },
        });

        // Check if the receipt was found
        if (!receipt) {
            return res.status(404).json({ message: `Receipt with ID ${id} not found.` });
        }

        // Format the receipt to include createdAt timestamp
        const formattedReceipt = {
            ...receipt,
            createdAt: receipt.createdAt.toISOString(), // Format createdAt for better readability
            customer: {
                ...receipt.customer,
                closingBalance: receipt.customer?.closingBalance || 0, // Ensure closingBalance is present
            },
        };

        res.status(200).json(formattedReceipt);
    } catch (error) {
        console.error('Error fetching receipt:', error);
        res.status(500).json({ error: 'Failed to fetch the receipt.' });
    }
};

module.exports = {
    getReceipts,
    getReceiptById,
};
