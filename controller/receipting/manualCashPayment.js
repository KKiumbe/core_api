const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to generate a receipt number with "RCPT" prefix
function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000); // Generates a number between 10000 and 99999
    return `RCPT${randomDigits}`; // Prefix with "RCPT"
}

const manualCashPayment = async (req, res) => {
    const { customerId, totalAmount, modeOfPayment, paidBy, paymentId } = req.body;

    // Validate required fields
    if (!customerId || !totalAmount || !modeOfPayment || !paidBy) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        // Step 1: Retrieve the customer
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found.' });
        }

        // Step 2: Retrieve the payment if paymentId is provided
        let payment;
        if (paymentId) {
            payment = await prisma.payment.findUnique({
                where: { id: paymentId },
            });

            if (!payment) {
                return res.status(404).json({ message: 'Payment not found.' });
            }
        }

        // Generate a unique receipt number
        const receiptNumber = generateReceiptNumber();

        // Step 3: Create or update the payment
        const updatedPayment = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                amount: totalAmount,
                modeOfPayment: modeOfPayment,
                receipted: true, // Mark as receipted
                createdAt: new Date(), // Set createdAt timestamp
            },
        });

        // Step 4: Create a receipt for the payment
        const receipt = await prisma.receipt.create({
            data: {
                customerId: customerId,
                amount: totalAmount,
                modeOfPayment: modeOfPayment,
                receiptNumber: receiptNumber,
                paidBy: paidBy,
                createdAt: new Date(), // Set createdAt timestamp
                paymentId: updatedPayment.id, // Link to the updated payment
            },
        });

        // Step 5: Update the customer's closing balance
        const newClosingBalance = customer.closingBalance - totalAmount;
        await prisma.customer.update({
            where: { id: customerId },
            data: {
                closingBalance: newClosingBalance,
            },
        });

        return res.status(201).json({
            message: 'Manual cash payment processed successfully.',
            receipt,
            updatedPayment,
            newClosingBalance,
        });
    } catch (error) {
        console.error('Error creating manual receipts:', error);
        res.status(500).json({ error: 'Failed to create manual receipts.' });
    }
};

module.exports = {
    manualCashPayment,
};
