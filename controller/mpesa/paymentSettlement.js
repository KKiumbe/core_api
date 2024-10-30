const { PrismaClient } = require('@prisma/client');
const { sendSMS } = require('../../routes/sms/sms');
const prisma = new PrismaClient();



async function generateUniqueReceiptNumber() {
    let receiptNumber;
    let exists = true;

    while (exists) {
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        receiptNumber = `RCPT${randomDigits}`;

        exists = await prisma.receipt.findUnique({
            where: { receiptNumber: receiptNumber },
        }) !== null;
    }

    return receiptNumber;
}

async function settleInvoice() {
    try {
        const mpesaTransactions = await prisma.mpesaTransaction.findMany({
            where: { processed: false },
        });

        if (mpesaTransactions.length === 0) {
            console.log("No unprocessed Mpesa transactions found.");
            return;
        }

        for (const transaction of mpesaTransactions) {
            const { BillRefNumber, TransAmount, id, FirstName, MSISDN: phone, TransID: MpesaCode, TransTime } = transaction;

            console.log(`Processing transaction: ${id} for amount: ${TransAmount}`);

            const paymentAmount = parseFloat(TransAmount);
            if (isNaN(paymentAmount) || paymentAmount <= 0) {
                console.log(`Invalid payment amount for transaction ${id}. Skipping.`);
                continue;
            }

            const existingPayment = await prisma.payment.findUnique({
                where: { mpesaTransactionId: MpesaCode },
            });

            if (existingPayment) {
                console.log(`Mpesa transaction ${MpesaCode} already exists in payment table. Skipping.`);
                continue;
            }

            const customer = await prisma.customer.findUnique({
                where: { phoneNumber: BillRefNumber },
                select: { id: true, closingBalance: true, phoneNumber: true, firstName: true },
            });

            if (!customer) {
                console.log(`No customer found with BillRefNumber ${BillRefNumber}.`);

                const payment = await prisma.payment.create({
                    data: {
                        amount: paymentAmount,
                        modeOfPayment: 'MPESA',
                        mpesaTransactionId: MpesaCode,
                        receipted: true,
                        createdAt: TransTime,
                        receiptId: null,
                    },
                });
                
            }

            const payment = await prisma.payment.create({
                data: {
                    amount: paymentAmount,
                    modeOfPayment: 'MPESA',
                    mpesaTransactionId: MpesaCode,
                    receipted: false,
                    createdAt: TransTime,
                    receiptId: null,
                },
            });

            const receiptNumber = await generateUniqueReceiptNumber();
            const { receipts, remainingAmount, newClosingBalance } = await processInvoices(paymentAmount, customer.id, payment.id);

            const receiptData = await prisma.receipt.create({
                data: {
                    amount: paymentAmount,
                    modeOfPayment: 'MPESA',
                    paidBy: FirstName,
                    transactionCode: MpesaCode,
                    phoneNumber: phone,
                    paymentId: payment.id,
                    customerId: customer.id,
                    receiptInvoices: {
                        create: receipts,
                    },
                    receiptNumber: receiptNumber,
                    createdAt: new Date(),
                },
            });

            await prisma.payment.update({
                where: { id: payment.id },
                data: { receiptId: receiptData.id },
            });

            await prisma.mpesaTransaction.update({
                where: { id: id },
                data: { processed: true },
            });

            // Update customer closing balance for the SMS message
            const finalClosingBalance = newClosingBalance;

            // Format the closing balance message
            const formattedBalanceMessage = finalClosingBalance < 0
                ? `Your closing balance is an overpayment of KES ${Math.abs(finalClosingBalance)}`
                : `Your closing balance is KES ${finalClosingBalance}`;

            // Construct and send the SMS message
            // After invoice settlement and balance adjustment
           const message = `Dear ${customer.firstName}, payment of KES ${paymentAmount} received successfully. ${formattedBalanceMessage}. Thank you for your payment!`;

            const sanitisedNumber = sanitizePhoneNumber(customer.phoneNumber);

            await sendSMS(sanitisedNumber, message);

            console.log(`Processed payment and created receipt for transaction ${MpesaCode}.`);
        }
    } catch (error) {
        console.error('Error processing Mpesa transactions in settleInvoice:', error);
    }
}

async function processInvoices(paymentAmount, customerId, paymentId) {
    const invoices = await prisma.invoice.findMany({
        where: { customerId: customerId, status: 'UNPAID' },
    });

    let remainingAmount = paymentAmount;
    const receipts = [];
    let totalPaidAmount = 0;

    await prisma.payment.update({
        where: { id: paymentId },
        data: { receipted: true },
    });

    for (const invoice of invoices) {
        if (remainingAmount <= 0) break;

        const invoiceDueAmount = invoice.invoiceAmount - invoice.amountPaid;
        const paymentForInvoice = Math.min(remainingAmount, invoiceDueAmount);

        const updatedInvoice = await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                amountPaid: invoice.amountPaid + paymentForInvoice,
                status: invoice.amountPaid + paymentForInvoice >= invoice.invoiceAmount ? 'PAID' : 'UNPAID',
            },
        });

        receipts.push({ invoiceId: updatedInvoice.id });
        remainingAmount -= paymentForInvoice;
        totalPaidAmount += paymentForInvoice;
    }

    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { closingBalance: true },
    });

    const newClosingBalance = remainingAmount > 0
        ? customer.closingBalance + remainingAmount
        : customer.closingBalance - totalPaidAmount;

    await prisma.customer.update({
        where: { id: customerId },
        data: { closingBalance: newClosingBalance },
    });

    return { receipts, remainingAmount, newClosingBalance };
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

module.exports = { settleInvoice };
