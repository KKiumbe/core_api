const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Controller function to fetch all receipts
const getReceipts = async (req, res) => {
    try {
        // Fetch all receipts with their associated payment and customer details
        const receipts = await prisma.receipt.findMany({
            include: {
                payment: true, // Include payment details
                customer: true, // Include customer details
                receiptInvoices: {
                    include: {
                        invoice: true // Include invoice details for each receipt
                    }
                }
            }
        });

        // Check if receipts were found
        if (!receipts.length) {
            return res.status(404).json({ message: 'No receipts found.' });
        }

        res.status(200).json(receipts);
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({ error: 'Failed to fetch receipts.' });
    }
};



// Controller function to fetch a receipt by its ID
const getReceiptById = async (req, res) => {
    const { id } = req.params; // Extract receipt ID from the route parameters

    try {
        // Fetch the receipt with the specified ID, including related payment, customer, and invoice details
        const receipt = await prisma.receipt.findUnique({
            where: {
                id: id, // Match the receipt by ID
            },
            include: {
                payment: true, // Include payment details
                customer: true, // Include customer details
                receiptInvoices: {
                    include: {
                        invoice: true // Include invoice details for each receipt
                    }
                }
            }
        });

        // Check if the receipt was found
        if (!receipt) {
            return res.status(404).json({ message: `Receipt with ID ${id} not found.` });
        }

        res.status(200).json(receipt);
    } catch (error) {
        console.error('Error fetching receipt:', error);
        res.status(500).json({ error: 'Failed to fetch the receipt.' });
    }
};




module.exports = {
    getReceipts,getReceiptById
};
