const { PrismaClient } = require('@prisma/client');
const { sendSMS } = require('../sms/smsController');


const prisma = new PrismaClient();

async function generateUniqueReceiptNumber() {
    let receiptNumber;
    let exists = true;

    while (exists) {
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        receiptNumber = `RCPT${randomDigits}`;
        exists = await prisma.receipt.findUnique({
            where: { receiptNumber },
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
            let paymentAmount = parseFloat(TransAmount);

            if (isNaN(paymentAmount) || paymentAmount <= 0) {
                console.log(`Invalid payment amount for transaction ${id}. Skipping.`);
                continue;
            }

            const existingPayment = await prisma.payment.findUnique({
                where: { transactionId: MpesaCode },
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
                await prisma.payment.create({
                    data: {
                        amount: paymentAmount,
                        modeOfPayment: 'MPESA',
                        transactionId: MpesaCode,
                        firstName: FirstName,
                        receipted: false,
                        createdAt: TransTime,
                        ref: BillRefNumber,
                    },
                });
                continue;
            }

            await prisma.$transaction(async (transactionPrisma) => {
                const payment = await transactionPrisma.payment.create({
                    data: {
                        amount: paymentAmount,
                        modeOfPayment: 'MPESA',
                        transactionId: MpesaCode,
                        firstName: FirstName,
                        receipted: false,
                        createdAt: TransTime,
                        ref: BillRefNumber,
                    },
                });

                console.log('Payment created:', payment);

                // Check for unpaid or partially paid invoices
                const invoices = await transactionPrisma.invoice.findMany({
                    where: {
                        customerId: customer.id,
                        status: {
                            in: ['UNPAID', 'PPAID'],
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                });

                let remainingAmount = paymentAmount;
                const receipts = [];

                if (invoices.length > 0) {
                    for (const invoice of invoices) {
                        if (remainingAmount <= 0) break;

                        const invoiceDueAmount = invoice.invoiceAmount - invoice.amountPaid;
                        const paymentForInvoice = Math.min(remainingAmount, invoiceDueAmount);

                        const updatedInvoice = await transactionPrisma.invoice.update({
                            where: { id: invoice.id },
                            data: {
                                amountPaid: invoice.amountPaid + paymentForInvoice,
                                status: invoice.amountPaid + paymentForInvoice >= invoice.invoiceAmount ? 'PAID' : 'PPAID',
                            },
                        });

                        receipts.push({ invoiceId: updatedInvoice.id });
                        remainingAmount -= paymentForInvoice;
                    }
                }

                if (invoices.length === 0 || remainingAmount > 0) {
                    // No invoices or remaining amount after invoices
                    const finalClosingBalance = customer.closingBalance - remainingAmount;

                    // Update customer's closing balance
                    await transactionPrisma.customer.update({
                        where: { id: customer.id },
                        data: { closingBalance: finalClosingBalance },
                    });

                    console.log(`Updated closing balance for customer ${customer.id}: ${finalClosingBalance}`);

                    // Create a receipt for the overpayment or closing balance adjustment
                    const receiptNumber = await generateUniqueReceiptNumber();
                    const receipt = await transactionPrisma.receipt.create({
                        data: {
                            customerId: customer.id,
                            amount: remainingAmount,
                            modeOfPayment: 'MPESA',
                            receiptNumber,
                            paymentId: payment.id,
                            paidBy: FirstName,
                            createdAt: new Date(),
                        },
                    });

                    receipts.push({ invoiceId: null, receiptId: receipt.id });

                    const balanceMessage = finalClosingBalance < 0
                        ? `an overpayment of KES ${Math.abs(finalClosingBalance)}`
                        : `KES ${finalClosingBalance}`;
                    const message = `Dear ${customer.firstName}, payment of KES ${paymentAmount} received successfully. Your balance is ${balanceMessage}. Thank you for your payment.`;
                    await sendSMS(customer.phoneNumber, message);

                    console.log('SMS sent to customer.');
                }

                await transactionPrisma.mpesaTransaction.update({
                    where: { id },
                    data: { processed: true },
                });

                console.log(`Processed transaction ${MpesaCode} successfully.`);
            });
        }
    } catch (error) {
        console.error('Error processing Mpesa transactions in settleInvoice:', error);
    }
}


// async function processInvoices(paymentAmount, customerId, paymentId, transactionPrisma) {
//     const invoices = await transactionPrisma.invoice.findMany({
//         where: {
//             customerId,
//             status: {
//                 in: ['UNPAID', 'PPAID'],
//             },
//         },
//         orderBy: { createdAt: 'asc' },
//     });

//     let remainingAmount = paymentAmount;
//     const receipts = [];

//     await transactionPrisma.payment.update({
//         where: { id: paymentId },
//         data: { receipted: true },
//     });

//     for (const invoice of invoices) {
//         if (remainingAmount <= 0) break;

//         const invoiceDueAmount = invoice.invoiceAmount - invoice.amountPaid;
//         const paymentForInvoice = Math.min(remainingAmount, invoiceDueAmount);

//         const updatedInvoice = await transactionPrisma.invoice.update({
//             where: { id: invoice.id },
//             data: {
//                 amountPaid: invoice.amountPaid + paymentForInvoice,
//                 status: invoice.amountPaid + paymentForInvoice >= invoice.invoiceAmount ? 'PAID' : 'PPAID',
//             },
//         });

//         receipts.push({ invoiceId: updatedInvoice.id });
//         remainingAmount -= paymentForInvoice;
//     }

//     const customer = await transactionPrisma.customer.findUnique({
//         where: { id: customerId },
//         select: { closingBalance: true },
//     });

//     const updatedClosingBalance = customer.closingBalance - remainingAmount;

//     if (remainingAmount > 0) {
//         await transactionPrisma.customer.update({
//             where: { id: customerId },
//             data: { closingBalance: updatedClosingBalance },
//         });

//         receipts.push({ invoiceId: null });
//         remainingAmount = 0;
//     }

//     return { receipts, updatedClosingBalance };
// }

module.exports = { settleInvoice };
