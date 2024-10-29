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

        // Step 2: Get unpaid invoices for the customer
        const invoices = await prisma.invoice.findMany({
            where: { customerId: customerId, status: 'UNPAID' },
            orderBy: { createdAt: 'asc' }, // Pay older invoices first
        });

        // Initialize variables for payment processing
        let remainingAmount = totalAmount;
        const receipts = []; // Store created receipts for each invoice
        const updatedInvoices = []; // Track updated invoices

        // Step 3: Allocate payment to invoices
        for (const invoice of invoices) {
            if (remainingAmount <= 0) break;

            const invoiceDue = invoice.invoiceAmount - invoice.amountPaid;
            const paymentForInvoice = Math.min(remainingAmount, invoiceDue);

            // Update invoice with the paid amount
            const updatedInvoice = await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    amountPaid: invoice.amountPaid + paymentForInvoice,
                    status: invoice.amountPaid + paymentForInvoice >= invoice.invoiceAmount ? 'PAID' : 'UNPAID',
                },
            });
            updatedInvoices.push(updatedInvoice);

            // Generate a unique receipt number
            const receiptNumber = generateReceiptNumber();

            // Create a receipt for this payment
            const receipt = await prisma.receipt.create({
                data: {
                    customerId: customerId,
                    amount: paymentForInvoice,
                    modeOfPayment: modeOfPayment,
                    receiptNumber: receiptNumber,
                    paymentId: paymentId || null,
                    paidBy: paidBy,
                    createdAt: new Date(),
                    receiptInvoices: {
                        create: { invoiceId: invoice.id },
                    },
                },
            });
            receipts.push(receipt);

            remainingAmount -= paymentForInvoice;
        }

        // Step 4: Handle overpayment
        let newClosingBalance = customer.closingBalance;
        if (remainingAmount > 0) {
            newClosingBalance -= remainingAmount; // Deduct overpayment from closing balance

            // Generate a receipt for the overpayment
            const receiptNumber = generateReceiptNumber();
            const overpaymentReceipt = await prisma.receipt.create({
                data: {
                    customerId: customerId,
                    amount: remainingAmount,
                    modeOfPayment: modeOfPayment,
                    receiptNumber: receiptNumber,
                    paymentId: paymentId || null,
                    paidBy: paidBy,
                    createdAt: new Date(),
                },
            });
            receipts.push(overpaymentReceipt);
        }

        // Update the customer's closing balance
        await prisma.customer.update({
            where: { id: customerId },
            data: { closingBalance: newClosingBalance },
        });

        res.status(201).json({
            message: 'Manual cash payment processed successfully.',
            receipts,
            updatedInvoices,
            newClosingBalance,
        });
    } catch (error) {
        console.error('Error creating manual cash payment:', error);
        res.status(500).json({ error: 'Failed to create manual cash payment.', details: error.message });
    }
};

module.exports = { manualCashPayment };
