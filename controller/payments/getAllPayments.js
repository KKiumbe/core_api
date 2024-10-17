const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Controller to fetch all payments with associated invoices
const fetchAllPayments = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            include: {
                receipt: {
                    include: {
                        receiptInvoices: {
                            include: {
                                invoice: true, // Include associated invoices
                            },
                        },
                    },
                },
            },
        });

        res.status(200).json(payments); // Respond with the payments data
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


// Controller to fetch a payment by ID with associated invoices
const fetchPaymentById = async (req, res) => {
    const { paymentId } = req.params; // Get the payment ID from request parameters

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId }, // Find the payment by ID
            include: {
                receipt: {
                    include: {
                        receiptInvoices: {
                            include: {
                                invoice: true, // Include associated invoices
                            },
                        },
                    },
                },
            },
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' }); // Handle case where payment is not found
        }

        res.status(200).json(payment); // Respond with the payment data
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Export the controller functions
module.exports = { fetchAllPayments, fetchPaymentById };
