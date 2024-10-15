const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to generate a receipt number with "RCPT" prefix
function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 90000); // Generates a number between 10000 and 99999
    return `RCPT${randomDigits}`; // Prefix with "RCPT"
}

async function settleInvoice() {
    try {
        // Step 1: Retrieve all unprocessed Mpesa transactions
        const mpesaTransactions = await prisma.mpesaTransaction.findMany({
            where: { processed: false },
        });

        if (mpesaTransactions.length === 0) {
            console.log("No unprocessed Mpesa transactions found.");
            return;
        }

        // Step 2: Loop through each unprocessed Mpesa transaction
        for (const transaction of mpesaTransactions) {
            const { BillRefNumber, TransAmount, id, FirstName, MSISDN: phone, TransID: MpesaCode } = transaction;

            console.log(`Processing transaction: ${id} for amount: ${TransAmount}`);

            const paymentAmount = parseFloat(TransAmount);

            if (isNaN(paymentAmount) || paymentAmount <= 0) {
                console.log(`Invalid payment amount for transaction ${id}. Skipping.`);
                continue;
            }

            // Step 3: Find the customer by matching the BillRefNumber (phone number)
            const customer = await prisma.customer.findUnique({
                where: { phoneNumber: BillRefNumber },
                select: { id: true, closingBalance: true },
            });

            if (!customer) {
                // Save the transaction in Payment with receipted: false
                await prisma.payment.create({
                    data: {
                        amount: paymentAmount,
                        modeOfPayment: 'MPESA',
                        mpesaTransactionId: MpesaCode,
                        receipted: false,
                    },
                });
                console.log(`No customer found with BillRefNumber ${BillRefNumber}. Transaction saved with receipted: false.`);
                continue;
            }

            // Step 4: Find unpaid invoices for the customer
            const invoices = await prisma.invoice.findMany({
                where: { customerId: customer.id, status: 'UNPAID' },
                orderBy: { createdAt: 'asc' },
            });

            if (invoices.length === 0) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        closingBalance: customer.closingBalance + paymentAmount,
                    },
                });
                console.log(`No unpaid invoices found for customer ${customer.id}. Overpayment added to closing balance.`);

                // Save the payment in Payment with receipted: false
                await prisma.payment.create({
                    data: {
                        amount: paymentAmount,
                        modeOfPayment: 'MPESA',
                        mpesaTransactionId: MpesaCode,
                        receipted: true,
                    },
                });
                continue;
            }

            let remainingAmount = paymentAmount;

            for (const invoice of invoices) {
                if (remainingAmount <= 0) break;

                const invoiceDueAmount = invoice.invoiceAmount - invoice.amountPaid;

                if (remainingAmount >= invoiceDueAmount) {
                    remainingAmount -= invoiceDueAmount;

                    // Update invoice to paid
                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            amountPaid: invoice.invoiceAmount,
                            status: 'PAID',
                        },
                    });

                    // Create a new payment for this receipt
                    const newPayment = await prisma.payment.create({
                        data: {
                            amount: invoiceDueAmount,
                            modeOfPayment: 'MPESA',
                            mpesaTransactionId: MpesaCode,
                            receipted: true,
                        },
                    });

                    // Generate a receipt number with "RCPT" prefix
                    const receiptNumber = generateReceiptNumber();

                    // Create the receipt and associate it with the invoice
                    await prisma.receipt.create({
                        data: {
                            amount: invoiceDueAmount,
                            modeOfPayment: 'MPESA',
                            paidBy: FirstName,
                            transactionCode: MpesaCode,
                            phoneNumber: phone,
                            paymentId: newPayment.id, // Link the created payment
                            customerId: customer.id, // Include customerId
                            receiptInvoices: {
                                create: {
                                    invoiceId: invoice.id, // Establish the many-to-many relationship
                                },
                            },
                            receiptNumber: receiptNumber, // Add receipt number
                        },
                    });
                } else {
                    // Partial payment for the invoice
                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            amountPaid: invoice.amountPaid + remainingAmount,
                        },
                    });

                    // Create a new payment for this receipt
                    const newPayment = await prisma.payment.create({
                        data: {
                            amount: remainingAmount,
                            modeOfPayment: 'MPESA',
                            mpesaTransactionId: MpesaCode,
                            receipted: true,
                        },
                    });

                    // Generate a receipt number with "RCPT" prefix
                    const receiptNumber = generateReceiptNumber();

                    await prisma.receipt.create({
                        data: {
                            amount: remainingAmount,
                            modeOfPayment: 'MPESA',
                            paidBy: FirstName,
                            transactionCode: MpesaCode,
                            phoneNumber: phone,
                            paymentId: newPayment.id, // Link the created payment
                            customerId: customer.id, // Include customerId
                            receiptInvoices: {
                                create: {
                                    invoiceId: invoice.id, // Establish the many-to-many relationship
                                },
                            },
                            receiptNumber: receiptNumber, // Add receipt number
                        },
                    });

                    remainingAmount = 0;
                }
            }

            // Handle any remaining amount after processing invoices
            if (remainingAmount > 0) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        closingBalance: customer.closingBalance + remainingAmount,
                    },
                });
                console.log(`Customer ${customer.id} overpaid. Closing balance adjusted by ${remainingAmount}.`);
            }

            // Mark the Mpesa transaction as processed
            await prisma.mpesaTransaction.update({
                where: { id: id },
                data: { processed: true },
            });

            console.log(`Mpesa transaction ${id} processed for customer ${customer.id}.`);
        }
    } catch (error) {
        console.error('Error processing Mpesa transactions in settleInvoice:', error);
    }
}

module.exports = { settleInvoice };