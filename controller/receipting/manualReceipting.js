const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    return `RCPT${randomDigits}`;
}

const manualCashPayment = async (req, res) => {
    const { customerId, totalAmount, modeOfPayment, paidBy, paymentId } = req.body;

    if (!customerId || !totalAmount || !modeOfPayment || !paidBy) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) return res.status(404).json({ message: 'Customer not found.' });

        const invoices = await prisma.invoice.findMany({
            where: { customerId: customerId, status: 'UNPAID' },
            orderBy: { createdAt: 'asc' },
        });

        let remainingAmount = totalAmount;
        const receipts = [];
        const updatedInvoices = [];

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

            const receiptNumber = generateReceiptNumber();

            const receipt = await prisma.receipt.create({
                data: {
                    customerId: customerId,
                    amount: paymentForInvoice,
                    modeOfPayment: modeOfPayment,
                    receiptNumber: receiptNumber,
                    paymentId: paymentId || null,
                    paidBy: paidBy,
                    createdAt: new Date(),
                    receiptInvoices: { create: { invoiceId: invoice.id } },
                },
            });
            receipts.push(receipt);

            remainingAmount -= paymentForInvoice;
        }

        let newClosingBalance = customer.closingBalance;
        if (remainingAmount > 0) {
            newClosingBalance -= remainingAmount;

            const overpaymentPayment = await prisma.payment.create({
                data: {
                    customerId: customerId,
                    amount: remainingAmount,
                    modeOfPayment: modeOfPayment,
                    receipted: true,
                    createdAt: new Date(),
                },
            });

            const receiptNumber = generateReceiptNumber();
            const overpaymentReceipt = await prisma.receipt.create({
                data: {
                    customerId: customerId,
                    amount: remainingAmount,
                    modeOfPayment: modeOfPayment,
                    receiptNumber: receiptNumber,
                    paymentId: overpaymentPayment.id,
                    paidBy: paidBy,
                    createdAt: new Date(),
                },
            });
            receipts.push(overpaymentReceipt);
        }

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
