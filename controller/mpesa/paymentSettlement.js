const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function settleInvoice() {
    try {
        // Step 1: Retrieve all unprocessed Mpesa transactions
        const mpesaTransactions = await prisma.mpesaTransaction.findMany({
            where: { processed: false }, // Only fetch unprocessed transactions
        });

        if (mpesaTransactions.length === 0) {
            console.log("No unprocessed Mpesa transactions found.");
            return;
        }

        // Step 2: Loop through each unprocessed Mpesa transaction
        for (const transaction of mpesaTransactions) {
            const { BillRefNumber, amount: paymentAmount, id: transactionId } = transaction;

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
                orderBy: { createdAt: 'asc' }, // Order by oldest first
            });

            // If there are no unpaid invoices, update closing balance as overpayment
            if (invoices.length === 0) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        closingBalance: customer.closingBalance + paymentAmount, // Adjust closing balance
                    },
                });
                console.log(`No unpaid invoices found for customer ${customer.id}. Overpayment added to closing balance.`);
                continue; // Move to the next transaction
            }

            // Step 5: Initialize remaining amount and process invoices
            let remainingAmount = paymentAmount;
            const updatedInvoices = []; // To store updated invoices

            for (const invoice of invoices) {
                if (remainingAmount <= 0) break;

                const invoiceDueAmount = invoice.invoiceAmount - invoice.amountPaid;

                if (remainingAmount >= invoiceDueAmount) {
                    // Fully pay this invoice
                    remainingAmount -= invoiceDueAmount;

                    const updatedInvoice = await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            amountPaid: invoice.invoiceAmount,
                            status: 'PAID',
                        },
                    });

                    updatedInvoices.push(updatedInvoice);

                    // Create a receipt for this full payment
                    await prisma.receipt.create({
                        data: {
                            customerId: customer.id,
                            invoiceId: updatedInvoice.id,
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

                    updatedInvoices.push(invoice);

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

            // Step 6: Update closing balance if there’s an overpayment
            if (remainingAmount > 0) {
                const newClosingBalance = customer.closingBalance + remainingAmount;
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: {
                        closingBalance: newClosingBalance,
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
