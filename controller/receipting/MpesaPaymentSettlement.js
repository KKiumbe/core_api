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
        await prisma.$transaction(async (prisma) => {
            // Retrieve customer data
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { id: true, closingBalance: true, phoneNumber: true, firstName: true },
            });

            if (!customer) {
                return res.status(404).json({ message: 'Customer not found.' });
            }

            // Check if payment with the provided ID exists and if it's already receipted
            const PaymentReceipted = await prisma.payment.findUnique({
                where: { id: paymentId },
            });
            
            if (!PaymentReceipted) {
                return res.status(404).json({ message: 'Payment not found.' });
            }

            if (PaymentReceipted.receipted) {
                return res.status(400).json({ message: 'Payment with this ID has already been receipted.' });
            }

            // Mark the payment as receipted
            await prisma.payment.update({
                where: { id: paymentId },
                data: { receipted: true },
            });

            // Get unpaid or partially paid invoices for the customer
            const invoices = await prisma.invoice.findMany({
                where: { customerId, OR: [{ status: 'UNPAID' }, { status: 'PPAID' }] },
                orderBy: { createdAt: 'asc' },
            });

            let remainingAmount = totalAmount;
            const receipts = [];
            const updatedInvoices = invoices.length ? [] : null; // Set to null if no invoices are found

            // Process payment if there are unpaid or partially paid invoices
            if (invoices.length > 0) {
                for (const invoice of invoices) {
                    if (remainingAmount <= 0) break;

                    const invoiceDue = invoice.invoiceAmount - invoice.amountPaid;
                    const paymentForInvoice = Math.min(remainingAmount, invoiceDue);

                    const newAmountPaid = invoice.amountPaid + paymentForInvoice;
                    const newStatus = newAmountPaid >= invoice.invoiceAmount ? 'PAID' : 'PPAID';

                    const updatedInvoice = await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            amountPaid: newAmountPaid,
                            status: newStatus,
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
                            paymentId: paymentId,
                            paidBy,
                            createdAt: new Date(),
                        },
                    });
                    receipts.push(receipt);
                    remainingAmount -= paymentForInvoice;
                }
            }

            // Calculate final closing balance
            const finalClosingBalance = customer.closingBalance - remainingAmount;

            // Create a receipt for any remaining amount if there are no invoices or overpayment
            if (remainingAmount > 0) {
                const overpaymentReceipt = await prisma.receipt.create({
                    data: {
                        customerId,
                        amount: remainingAmount,
                        modeOfPayment,
                        receiptNumber: generateReceiptNumber(),
                        paymentId: paymentId,
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
                message: 'Payment processed successfully.',
                receipts,
                updatedInvoices: updatedInvoices,
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
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Failed to process payment.', details: error.message });
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
