const { PrismaClient } = require('@prisma/client');
const { sendSMS } = require('../../routes/sms/sms');
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
            select: { phoneNumber: true, firstName: true, closingBalance: true }, // Fetch only necessary fields
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

        // Step 1: Find unpaid invoices and apply payment
        const invoices = await prisma.invoice.findMany({
            where: { customerId, status: 'UNPAID' },
            orderBy: { createdAt: 'asc' },
        });

        let remainingAmount = totalAmount;
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
            remainingAmount -= paymentForInvoice;
        }

        // Update customer closing balance
        await prisma.customer.update({
            where: { id: customerId },
            data: { closingBalance: newClosingBalance },
        });

        // SMS Notification message
   


        const text = `Dear ${customer.firstName}, payment of KES ${totalAmount} received successfully. Your balance is ${newClosingBalance}. Help us serve you better by Always using Paybill No: 4107197, your phone number as the account number to pay your garbage collection bill. Customer support: 0726594923.`;
        
        //const sanitisedNumber = sanitizePhoneNumber(customer.phoneNumber);

        // Send SMS
        await sendSMS(customer,text);
        //console.log(`SMS sent to ${sanitisedNumber}: ${message}`);

        res.status(201).json({
            message: 'Payment and receipt created successfully, SMS notification sent.',
            receipt,
            updatedPayment,
            updatedInvoices,
            newClosingBalance,
        });
    } catch (error) {
        console.error('Error creating manual cash payment:', error);
        res.status(500).json({ error: 'Failed to create manual cash payment.', details: error.message });
    }
};

// Helper function to format phone number
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

module.exports = { manualCashPayment };
