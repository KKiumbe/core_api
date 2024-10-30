const { PrismaClient } = require('@prisma/client');
const { sendSMS } = require('../../routes/sms/sms');
const prisma = new PrismaClient();

function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    return `RCPT${randomDigits}`;
}

const MpesaPaymentSettlement = async (req, res) => {
    const { customerId, totalAmount, modeOfPayment, paidBy, paymentId } = req.body;

    if (!customerId || !totalAmount || !modeOfPayment || !paidBy) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        // Step 1: Start transaction to ensure atomicity
        await prisma.$transaction(async (prisma) => {

            // Retrieve customer data
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { id: true, closingBalance: true, phoneNumber: true, firstName: true },
            });

            if (!customer) {
                return res.status(404).json({ message: 'Customer not found.' });
            }

            // Generate or use provided transaction ID
            //const generatedMpesaTransactionId = mpesaTransactionId || `MP${Math.floor(1000000 + Math.random() * 9000000).toString()}`;

            // Check if this transaction has already been receipted
            const PaymentReceipted = await prisma.payment.findFirst({
                where: { id: paymentId, receipted: true },
            });
            if (PaymentReceipted.receipted) {
                return res.status(400).json({ message: 'Payment with this MPESA transaction ID has already been receipted.' });
            }

            await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    receipted: true,
                },
            });
            

            // Get unpaid invoices for the customer
            const invoices = await prisma.invoice.findMany({
                where: { customerId, status: 'UNPAID' },
                orderBy: { createdAt: 'asc' },
            });

            let remainingAmount = totalAmount;
            const receipts = [];
            const updatedInvoices = [];

            // Allocate payment to invoices
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
                        customerId,
                        amount: paymentForInvoice,
                        modeOfPayment,
                        receiptNumber,
                        paymentId: payment.id,
                        paidBy,
                        createdAt: new Date(),
                    },
                });
                receipts.push(receipt);
                remainingAmount -= paymentForInvoice;
            }

            // Handle overpayment
            let finalClosingBalance = customer.closingBalance;
            if (remainingAmount > 0) {
                finalClosingBalance -= remainingAmount;

                const overpaymentReceiptNumber = generateReceiptNumber();
                const overpaymentReceipt = await prisma.receipt.create({
                    data: {
                        customerId,
                        amount: remainingAmount,
                        modeOfPayment,
                        receiptNumber: overpaymentReceiptNumber,
                        paymentId: payment.id,
                        paidBy,
                        createdAt: new Date(),
                    },
                });
                receipts.push(overpaymentReceipt);
            }

            // Update customer's closing balance
            await prisma.customer.update({
                where: { id: customerId },
                data: { closingBalance: finalClosingBalance },
            });

            res.status(201).json({
                message: 'Manual cash payment processed successfully.',
                receipts,
                updatedInvoices,
                newClosingBalance: finalClosingBalance,
            });

            // Send confirmation SMS
            const balanceMessage = finalClosingBalance < 0
                ? `Your closing balance is an overpayment of KES ${Math.abs(finalClosingBalance)}`
                : `Your closing balance is KES ${finalClosingBalance}`;
            const message = `Dear ${customer.firstName}, payment of KES ${totalAmount} received successfully. ${balanceMessage}. Thank you for your payment!`;
            const sanitizedNumber = sanitizePhoneNumber(customer.phoneNumber);
            await sendSMS(sanitizedNumber, message);
        });

    } catch (error) {
        console.error('Error creating manual cash payment:', error);
        res.status(500).json({ error: 'Failed to create manual cash payment.', details: error.message });
    }
};

function sanitizePhoneNumber(phone) {
    if (typeof phone !== 'string') {
        console.error('Invalid phone number format:', phone);
        return '';
    }

    if (phone.startsWith('+254')) {
        return phone.slice(1);
    } else if (phone.startsWith('0')) {
        return `254${phone.slice(1)}`;
    } else if (phone.startsWith('254')) {
        return phone;
    } else {
        return `254${phone}`;
    }
}

module.exports = { MpesaPaymentSettlement };
