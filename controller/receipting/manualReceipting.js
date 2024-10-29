const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

        // Calculate the new closing balance based on the total amount
        const newClosingBalance = customer.closingBalance - totalAmount;

        // Step 2: Create or update the payment
        let updatedPayment;
        if (paymentId) {
            // If paymentId is provided, update the existing payment
            updatedPayment = await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    amount: totalAmount,
                    modeOfPayment: modeOfPayment,
                    receipted: true,
                    createdAt: new Date(),
                },
            });
        } else {
            // If no paymentId is provided, create a new payment
            updatedPayment = await prisma.payment.create({
                data: {
                    amount: totalAmount,
                    modeOfPayment: modeOfPayment,
                    receipted: true,
                    createdAt: new Date(),
                },
            });
        }

        // Step 3: Create the receipt
        const receiptNumber = generateReceiptNumber();
        const receipt = await prisma.receipt.create({
            data: {
                customerId: customerId,
                amount: totalAmount,
                modeOfPayment: modeOfPayment,
                receiptNumber: receiptNumber,
                paymentId: updatedPayment.id, // Link the newly created/updated payment
                paidBy: paidBy,
                createdAt: new Date(),
            },
        });

        // Handle overpayment or underpayment logic
        if (newClosingBalance < 0) {
            // Overpayment scenario
            const overpaymentAmount = Math.abs(newClosingBalance);
            const overpaymentReceipt = await prisma.receipt.create({
                data: {
                    customerId: customerId,
                    amount: overpaymentAmount,
                    modeOfPayment: modeOfPayment,
                    receiptNumber: generateReceiptNumber(),
                    payment: {
                        create: {
                            amount: overpaymentAmount,
                            modeOfPayment: modeOfPayment,
                            receipted: true,
                            createdAt: new Date(),
                        },
                    },
                    paidBy: paidBy,
                    createdAt: new Date(),
                },
            });

            return res.status(201).json({
                message: 'Overpayment receipt created successfully.',
                receipt,
                overpaymentReceipt,
                newClosingBalance: 0, // Closing balance is set to 0 after overpayment
            });
        } else if (newClosingBalance > 0) {
            // Underpayment scenario
            await prisma.customer.update({
                where: { id: customerId },
                data: { closingBalance: newClosingBalance },
            });

            return res.status(201).json({
                message: 'Payment and receipt created successfully.',
                receipt,
                updatedPayment,
                newClosingBalance,
            });
        } else {
            // Exact payment scenario
            await prisma.customer.update({
                where: { id: customerId },
                data: { closingBalance: newClosingBalance },
            });

            return res.status(201).json({
                message: 'Payment and receipt created successfully. No balance remaining.',
                receipt,
                updatedPayment,
                newClosingBalance,
            });
        }
    } catch (error) {
        console.error('Error creating manual cash payment:', error);
        res.status(500).json({ error: 'Failed to create manual cash payment.', details: error.message });
    }
};

module.exports = {
    manualCashPayment,
};
