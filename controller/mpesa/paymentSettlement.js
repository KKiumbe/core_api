const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to generate a receipt number with "RCPT" prefix
function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000); // Generates a number between 10000 and 99999
    return `RCPT${randomDigits}`; // Prefix with "RCPT"
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
                select: { id: true, closingBalance: true },
            });

            if (!customer) {
                const receiptNumber = generateReceiptNumber(); // Generate a receipt number

                // Check for existing payments that match this transaction but may or may not have a receipt
                const existingReceiptPayment = await prisma.payment.findFirst({
                    where: {
                        OR: [
                            { receiptId: { not: null } }, // Check if there's a payment with a receipt
                            { mpesaTransactionId: MpesaCode, receiptId: null } // Or check if it's the same transaction without a receipt
                        ]
                    }
                });

                if (!existingReceiptPayment) {
                    // Save the transaction in Payment with receipted: false
                    const payment = await prisma.payment.create({
                        data: {
                            amount: paymentAmount,
                            modeOfPayment: 'MPESA',
                            mpesaTransactionId: MpesaCode,
                            receipted: false,
                            createdAt: TransTime,
                            receiptId: null, // No receipt yet
                        },
                    });

                    // Create a new receipt for the unlinked payment
                    await createReceipt(paymentAmount, MpesaCode, FirstName, phone, null, null, payment.id);
                } else {
                    console.log(`Payment already exists for transaction ${MpesaCode}. Skipping receipt creation.`);
                }

                // Mark the Mpesa transaction as processed
                await prisma.mpesaTransaction.update({
                    where: { id: id },
                    data: { processed: true },
                });

                console.log(`No customer found with BillRefNumber ${BillRefNumber}. Transaction saved with receipted: false.`);
                continue;
            }

            // Handle the case where the customer exists and process payments
            // Existing code for handling invoices and payments...
        }
    } catch (error) {
        console.error('Error processing Mpesa transactions in settleInvoice:', error);
    }
}






// Helper function to create receipt
async function createReceipt(amount, MpesaCode, FirstName, phone, customerId, invoiceId, paymentId) {
    const receiptNumber = generateReceiptNumber();
    await prisma.receipt.create({
        data: {
            amount: amount,
            modeOfPayment: 'MPESA',
            paidBy: FirstName,
            transactionCode: MpesaCode,
            phoneNumber: phone,
            paymentId: paymentId,
            customerId: customerId,
            receiptInvoices: {
                create: { invoiceId: invoiceId },
            },
            receiptNumber: receiptNumber,
            createdAt: new Date(),
        },
    });
}

module.exports = { settleInvoice };
