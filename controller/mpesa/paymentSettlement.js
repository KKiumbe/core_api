const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to generate a unique receipt number with "RCPT" prefix
async function generateUniqueReceiptNumber() {
    let receiptNumber;
    let exists = true;

    while (exists) {
        const randomDigits = Math.floor(10000 + Math.random() * 90000); // Generates a number between 10000 and 99999
        receiptNumber = `RCPT${randomDigits}`; // Prefix with "RCPT"

        // Check if this receipt number already exists
        exists = await prisma.receipt.findUnique({
            where: { receiptNumber: receiptNumber },
        }) !== null;
    }

    return receiptNumber; // Return a unique receipt number
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
                console.log(`No customer found with BillRefNumber ${BillRefNumber}.`);

                const existingReceiptPayment = await prisma.payment.findFirst({
                    where: {
                        OR: [
                            { receiptId: { not: null } },
                            { mpesaTransactionId: MpesaCode, receiptId: null }
                        ]
                    }
                });

                if (!existingReceiptPayment) {
                    console.log(`No existing receipt payment found for transaction ${MpesaCode}. Creating payment.`);
                    // Save the transaction in Payment with receipted: false
                    const payment = await prisma.payment.create({
                        data: {
                            amount: paymentAmount,
                            modeOfPayment: 'MPESA',
                            mpesaTransactionId: MpesaCode,
                            receipted: false,
                            createdAt: TransTime,
                            receiptId: null, // Explicitly set receiptId to null
                        },
                    });

                    // Create the receipt only if it doesn't already exist for this payment
                    const existingReceipt = await prisma.receipt.findUnique({
                        where: { paymentId: payment.id },
                    });

                    if (!existingReceipt) {
                        const receiptNumber = await generateUniqueReceiptNumber();
                        await prisma.receipt.create({
                            data: {
                                amount: paymentAmount,
                                modeOfPayment: 'MPESA',
                                paidBy: FirstName,
                                transactionCode: MpesaCode,
                                phoneNumber: phone,
                                paymentId: payment.id, // Link to the created payment
                                receiptInvoices: {
                                    create: { invoiceId: null }, // Set this according to your invoice logic
                                },
                                receiptNumber: receiptNumber,
                                createdAt: new Date(),
                            },
                        });

                        // Update the payment with the generated receipt ID
                        await prisma.payment.update({
                            where: { id: payment.id },
                            data: { receiptId: receiptNumber }, // Update payment with the new receipt ID
                        });
                    } else {
                        console.log(`Receipt already exists for payment ${payment.id}. Skipping receipt creation.`);
                    }

                    // Mark the Mpesa transaction as processed
                    await prisma.mpesaTransaction.update({
                        where: { id: id },
                        data: { processed: true },
                    });

                    console.log(`Transaction saved with receipted: false.`);
                } else {
                    console.log(`Payment already exists for transaction ${MpesaCode}. Skipping receipt creation.`);
                }
                continue; // Ensure we skip further processing for this transaction
            }

            // Customer exists: create payment and receipt
            const payment = await prisma.payment.create({
                data: {
                    amount: paymentAmount,
                    modeOfPayment: 'MPESA',
                    mpesaTransactionId: MpesaCode,
                    receipted: true,
                    createdAt: TransTime,
                    receiptId: null, // Initially set receiptId to null
                },
            });

            // Create the receipt only if it doesn't already exist for this payment
            const existingReceipt = await prisma.receipt.findUnique({
                where: { paymentId: payment.id },
            });

            if (!existingReceipt) {
                const receiptNumber = await generateUniqueReceiptNumber();
                await prisma.receipt.create({
                    data: {
                        amount: paymentAmount,
                        modeOfPayment: 'MPESA',
                        paidBy: FirstName,
                        transactionCode: MpesaCode,
                        phoneNumber: phone,
                        paymentId: payment.id, // Link to the created payment
                        customerId: customer.id,
                        receiptInvoices: {
                            create: { invoiceId: null }, // Set this according to your invoice logic
                        },
                        receiptNumber: receiptNumber,
                        createdAt: new Date(),
                    },
                });

                // Update the payment with the generated receipt ID
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: { receiptId: receiptNumber }, // Update payment with the new receipt ID
                });
            } else {
                console.log(`Receipt already exists for payment ${payment.id}. Skipping receipt creation.`);
            }

            // Mark the Mpesa transaction as processed
            await prisma.mpesaTransaction.update({
                where: { id: id },
                data: { processed: true },
            });

            console.log(`Processed payment and created receipt for transaction ${MpesaCode}.`);
        }
    } catch (error) {
        console.error('Error processing Mpesa transactions in settleInvoice:', error);
    }
}

module.exports = { settleInvoice };
