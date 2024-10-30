const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    return `RCPT${randomDigits}`;
}

function generateTransactionId() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    return `C${randomDigits}`; // Prefix with "C"
}

const manualCashPayment = async (req, res) => {
    const { customerId, totalAmount, modeOfPayment, paidBy, paymentId } = req.body;

    if (!customerId || !totalAmount || !modeOfPayment || !paidBy) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found.' });
        }

        // Generate a unique TransactionId
        const transactionId = generateTransactionId();
        const newClosingBalance = customer.closingBalance - totalAmount;

        let updatedPayment;
        if (paymentId) {
            updatedPayment = await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    amount: totalAmount,
                    modeOfPayment: modeOfPayment,
                    TransactionId: transactionId,
                    receipted: true,
                    createdAt: new Date(),
                },
            });
        } else {
            updatedPayment = await prisma.payment.create({
                data: {
                    amount: totalAmount,
                    modeOfPayment: modeOfPayment,
                    TransactionId: transactionId,
                    receipted: true,
                    createdAt: new Date(),
                },
            });
        }

        const receiptNumber = generateReceiptNumber();
        const receipt = await prisma.receipt.create({
            data: {
                customerId: customerId,
                amount: totalAmount,
                modeOfPayment: modeOfPayment,
                receiptNumber: receiptNumber,
                paymentId: updatedPayment.id,
                paidBy: paidBy,
                createdAt: new Date(),
            },
        });

        // Step 1: Find unpaid invoices
        const invoices = await prisma.invoice.findMany({
            where: { customerId, status: 'UNPAID' },
            orderBy: { createdAt: 'asc' },
        });

        let remainingAmount = totalAmount;
        const updatedInvoices = [];

        // Step 2: Allocate payment to unpaid invoices
        for (const invoice of invoices) {
            if (remainingAmount <= 0) break;

            const invoiceDue = invoice.invoiceAmount - invoice.amountPaid;
            const paymentForInvoice = Math.min(remainingAmount, invoiceDue);

            const updatedInvoice = await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    amountPaid: invoice.amountPaid + paymentForInvoice,
                    status: invoice.amountPaid + paymentForInvoice >= invoice.invoiceAmount ? 'PAID' : 'UNPAID',
                },
            });
            updatedInvoices.push(updatedInvoice);
            remainingAmount -= paymentForInvoice;
        }

        // Step 3: Handle any remaining amount as an overpayment
        if (remainingAmount > 0) {
            // Create a new payment record for the overpayment
            const overpaymentTransactionId = generateTransactionId();
            const overpaymentPayment = await prisma.payment.create({
                data: {
                    amount: remainingAmount,
                    modeOfPayment: modeOfPayment,
                    TransactionId: overpaymentTransactionId,
                    receipted: true,
                    createdAt: new Date(),
                },
            });

            // Create a receipt for the overpayment
            const overpaymentReceipt = await prisma.receipt.create({
                data: {
                    customerId: customerId,
                    amount: remainingAmount,
                    modeOfPayment: modeOfPayment,
                    receiptNumber: generateReceiptNumber(),
                    paymentId: overpaymentPayment.id,  // Associate with the new overpayment
                    paidBy: paidBy,
                    createdAt: new Date(),
                },
            });

            // Update the customer's closing balance to reflect the overpayment
            await prisma.customer.update({
                where: { id: customerId },
                data: { closingBalance: newClosingBalance }, // Just reflect the new closing balance without deducting again
            });

            return res.status(201).json({
                message: 'Payment and overpayment receipt created successfully.',
                receipt,
                overpaymentReceipt,
                updatedInvoices,
                newClosingBalance: newClosingBalance, // Show the new closing balance including the overpayment
            });
        } else {
            // Update the customer's closing balance
            await prisma.customer.update({
                where: { id: customerId },
                data: { closingBalance: newClosingBalance },
            });

            return res.status(201).json({
                message: 'Payment and receipt created successfully.',
                receipt,
                updatedPayment,
                updatedInvoices,
                newClosingBalance: newClosingBalance,
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
