const { PrismaClient } = require('@prisma/client');
const { sendSMS } = require('../../routes/sms/sms'); // Make sure this path is correct for your SMS function
const prisma = new PrismaClient();

function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    return `RCPT${randomDigits}`;
}

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

async function settleInvoices(customerId, paymentAmount) {
    const invoices = await prisma.invoice.findMany({
        where: { customerId, status: 'UNPAID' },
        orderBy: { createdAt: 'asc' },
    });

    let remainingPayment = paymentAmount;
    const updatedInvoices = [];

    for (const invoice of invoices) {
        if (remainingPayment <= 0) break;

        const invoiceDue = invoice.invoiceAmount - invoice.amountPaid;
        const paymentForInvoice = Math.min(remainingPayment, invoiceDue);

        const updatedInvoice = await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                amountPaid: invoice.amountPaid + paymentForInvoice,
                status: invoice.amountPaid + paymentForInvoice >= invoice.invoiceAmount ? 'PAID' : 'UNPAID',
            },
        });
        updatedInvoices.push(updatedInvoice);

        remainingPayment -= paymentForInvoice;
    }

    return { updatedInvoices, remainingPayment };
}

const manualCashPayment = async (req, res) => {
    const { customerId, totalAmount, modeOfPayment, paidBy, paymentId } = req.body;

    if (!customerId || !totalAmount || !modeOfPayment || !paidBy) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        const transactionResult = await prisma.$transaction(async (prisma) => {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { id: true, closingBalance: true, firstName: true, phoneNumber: true },
            });

            if (!customer) {
                throw new Error('Customer not found.');
            }

            const newClosingBalance = customer.closingBalance - totalAmount;

            let paymentRecord;
            if (paymentId) {
                paymentRecord = await prisma.payment.update({
                    where: { id: paymentId },
                    data: { amount: totalAmount, modeOfPayment, receipted: true, createdAt: new Date() },
                });
            } else {
                paymentRecord = await prisma.payment.create({
                    data: { amount: totalAmount, modeOfPayment, receipted: true, createdAt: new Date() },
                });
            }

            const receiptNumber = generateReceiptNumber();
            const receipt = await prisma.receipt.create({
                data: {
                    customerId,
                    amount: totalAmount,
                    modeOfPayment,
                    receiptNumber,
                    paymentId: paymentRecord.id,
                    paidBy,
                    createdAt: new Date(),
                },
            });

            const { updatedInvoices, remainingPayment } = await settleInvoices(customerId, totalAmount);

            let finalClosingBalance = newClosingBalance;
            if (remainingPayment > 0) {
                finalClosingBalance += remainingPayment;

                const overpaymentReceiptNumber = generateReceiptNumber();
                await prisma.receipt.create({
                    data: {
                        customerId,
                        amount: remainingPayment,
                        modeOfPayment,
                        receiptNumber: overpaymentReceiptNumber,
                        paymentId: paymentRecord.id,
                        paidBy,
                        createdAt: new Date(),
                    },
                });
            }

            await prisma.customer.update({
                where: { id: customerId },
                data: { closingBalance: finalClosingBalance },
            });

            // Construct the SMS message
            const formattedBalanceMessage = finalClosingBalance < 0
                ? `Your closing balance is an overpayment of KES ${Math.abs(finalClosingBalance)}`
                : `Your closing balance is KES ${finalClosingBalance}`;

            const message = `Dear ${customer.firstName}, payment of KES ${totalAmount} received successfully. ${formattedBalanceMessage}. Thank you for your payment!`;

            // Send the SMS
            const sanitizedNumber = sanitizePhoneNumber(customer.phoneNumber);
            await sendSMS(sanitizedNumber, message);

            return {
                message: 'Manual cash payment processed successfully.',
                receipt,
                updatedInvoices,
                newClosingBalance: finalClosingBalance,
            };
        });

        res.status(201).json(transactionResult);
    } catch (error) {
        console.error('Error creating manual cash payment:', error);
        res.status(500).json({ error: 'Failed to create manual cash payment.', details: error.message });
    }
};

module.exports = {
    manualCashPayment,
};
