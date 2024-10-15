const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
            const { BillRefNumber, TransAmount, id: transactionId } = transaction; // Ensure 'id' is used if '_id' is not defined

            console.log(`Processing transaction: ${transactionId} for amount: ${TransAmount}`);

            // Convert TransAmount to a float
            const paymentAmount = parseFloat(TransAmount);
            if (isNaN(paymentAmount) || paymentAmount <= 0) {
                console.log(`Invalid payment amount for transaction ${transactionId}. Skipping.`);
                continue;
            }

            // Step 3: Find the customer by matching the BillRefNumber (phone number)
            const customer = await prisma.customer.findUnique({
                where: { phoneNumber: BillRefNumber },
                select: { id: true, closingBalance: true },
            });

            if (!customer) {
                console.log(`No customer found with phone number ${BillRefNumber}`);
                continue; // Skip if no customer found
            }

            // Step 4: Find unpaid invoices for the customer
            const invoices = await prisma.invoice.findMany({
                where: { customerId: customer.id, status: 'UNPAID' },
                orderBy: { createdAt: 'asc' },
            });

            // If there are no unpaid invoices, update closing balance as overpayment
            if (invoices.length === 0) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        closingBalance: customer.closingBalance + paymentAmount,
                    },
                });
                console.log(`No unpaid invoices found for customer ${customer.id}. Overpayment added to closing balance.`);
                continue;
            }

            // Step 5: Process invoices
            let remainingAmount = paymentAmount;

            for (const invoice of invoices) {
                if (remainingAmount <= 0) break;

                const invoiceDueAmount = invoice.invoiceAmount - invoice.amountPaid;

                if (remainingAmount >= invoiceDueAmount) {
                    // Fully pay this invoice
                    remainingAmount -= invoiceDueAmount;

                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            amountPaid: invoice.invoiceAmount,
                            status: 'PAID',
                        },
                    });

                    // Create a receipt for this full payment
                    await prisma.receipt.create({
                        data: {
                            customerId: customer.id,
                            invoiceId: invoice.id,
                            amount: invoice.invoiceAmount,
                            modeOfPayment: 'MPESA',
                        },
                    });
                } else {
                    // Partially pay this invoice
                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            amountPaid: invoice.amountPaid + remainingAmount,
                        },
                    });

                    // Create a receipt for this partial payment
                    await prisma.receipt.create({
                        data: {
                            customerId: customer.id,
                            invoiceId: invoice.id,
                            amount: remainingAmount,
                            modeOfPayment: 'MPESA',
                        },
                    });

                    remainingAmount = 0; // Remaining amount exhausted
                }
            }

            // Step 6: Update closing balance if there's an overpayment
            if (remainingAmount > 0) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        closingBalance: customer.closingBalance + remainingAmount,
                    },
                });
                console.log(`Customer ${customer.id} overpaid. Closing balance adjusted by ${remainingAmount}.`);
            }

            // Step 7: Mark the Mpesa transaction as processed
            await prisma.mpesaTransaction.update({
                where: { id: transactionId },
                data: { processed: true },
            });

            console.log(`Mpesa transaction ${transactionId} processed for customer ${customer.id}.`);
        }
    } catch (error) {
        console.error('Error processing Mpesa transactions in settleInvoice:', error);
    }
}

module.exports = { settleInvoice };
