const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();



const SMS_API_KEY = process.env.SMS_API_KEY;
const PARTNER_ID = process.env.PARTNER_ID;
const SHORTCODE = process.env.SHORTCODE;
const SMS_ENDPOINT = process.env.SMS_ENDPOINT;
const SMS_BALANCE_URL = process.env.SMS_BALANCE_URL;


function generateReceiptNumber() {
    const randomDigits = Math.floor(10000 + Math.random() * 900000);
    return `RCPT${randomDigits}`;
}

const MpesaPaymentSettlement = async (req, res) => {
    const { customerId, modeOfPayment, paidBy, paymentId } = req.body;

    if (!customerId || !modeOfPayment || !paidBy || !paymentId) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
      
            // Retrieve customer data
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { id: true, closingBalance: true, phoneNumber: true, firstName: true },
            });

            if (!customer) {
                return res.status(404).json({ message: 'Customer not found.' });
            }

            // Retrieve the payment amount
            const payment = await prisma.payment.findUnique({
                where: { id: paymentId },
                select: { amount: true, receipted: false },
            });
            
            if (!payment) {
                return res.status(404).json({ message: 'Payment not found.' });
            }

            if (payment.receipted) {
                return res.status(400).json({ message: 'Payment with this ID has already been receipted.' });
            }

            const totalAmount = payment.amount; // Get the amount from the payment record

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

                    // Create receipt for the amount applied to this invoice
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

            // Handle remaining amount (overpayment) if there is any left after applying to invoices
            if (remainingAmount > 0) {
                const overpaymentReceiptNumber = generateReceiptNumber();
                const overpaymentReceipt = await prisma.receipt.create({
                    data: {
                        customerId,
                        amount: remainingAmount,
                        modeOfPayment,
                        receiptNumber: overpaymentReceiptNumber,
                        paymentId: paymentId,
                        paidBy,
                        createdAt: new Date(),
                    },
                });
                receipts.push(overpaymentReceipt);
            }

            // Calculate the new closing balance
            //changes to scenarios of balance adding 
            const finalClosingBalance = customer.closingBalance - totalAmount;

            // Update customer's closing balance
            await prisma.customer.update({
                where: { id: customerId },
                data: { closingBalance: finalClosingBalance },
            });

            res.status(201).json({
                message: 'Payment processed successfully.',
                receipts,
                updatedInvoices,
                newClosingBalance: finalClosingBalance,
            });

            // Send confirmation SMS
            const balanceMessage = finalClosingBalance < 0
                ? `Your closing balance is an overpayment of KES ${Math.abs(finalClosingBalance)}`
                : `Your closing balance is KES ${finalClosingBalance}`;
            const text = `Dear ${customer.firstName}, payment of KES ${totalAmount} for garbage collection services received successfully. ${balanceMessage}. Always use your phone number as the account number, Thank you!`;
           //const mobile = customer.phoneNumber;
           
            await sendSMS(text,customer);
     

    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Failed to process payment.', details: error.message });
    }
};

// function sanitizePhoneNumber(phone) {
//     if (typeof phone !== 'string') {
//         console.error('Invalid phone number format:', phone);
//         return '';
//     }

//     if (phone.startsWith('+254')) {
//         return phone.slice(1);
//     } else if (phone.startsWith('0')) {
//         return `254${phone.slice(1)}`;
//     } else if (phone.startsWith('254')) {
//         return phone;
//     } else {
//         return `254${phone}`;
//     }
// }





// Function to check SMS balance
const checkSmsBalance = async () => {
    try {
        const response = await axios.post(SMS_BALANCE_URL, {
            apikey: SMS_API_KEY,
            partnerID: PARTNER_ID
        });
        return response.data.balance; // Adjust this based on actual response structure
    } catch (error) {
        console.error('Error fetching SMS balance:', error);
        throw new Error('Failed to retrieve SMS balance');
    }
};

// Function to send SMS with balance check
const sendSMS = async (text, customer) => {
    try {
        if (!customer.phoneNumber) {
            throw new Error("Customer's phone number is missing.");
        }

        const mobile = customer.phoneNumber; // Ensure mobile is a string with the phone number
        const clientsmsid = Math.floor(Math.random() * 1000000);

        // Check SMS balance
        const balance = await checkSmsBalance();
        if (balance < 1) {
            throw new Error('Insufficient SMS balance');
        }

        // Create an SMS record with initial status 'pending'
        const smsRecord = await prisma.sms.create({
            data: {
                clientsmsid,
                customerId: customer.id,
                mobile,
                message: text,
                status: 'pending',
            },
        });

        // Construct the payload following the exact structure needed
        const payload = {
            apikey: SMS_API_KEY,
            partnerID: PARTNER_ID,
            message: text,        // Message content
            shortcode: SHORTCODE,  // Sender ID or shortcode
            mobile: mobile,        // Phone number in international format
        };

        console.log("This is payload:", JSON.stringify(payload));  // Log to confirm correct payload format

        const response = await axios.post(SMS_ENDPOINT, payload);

        // Update SMS record status to 'sent' after successful send
        await prisma.sms.update({
            where: { id: smsRecord.id },
            data: { status: 'sent' },
        });

        return response.data;
    } catch (error) {
        console.error('Error sending SMS:', error);

        // Update SMS status to 'failed' if there's an error
        if (clientsmsid) {
            await prisma.sms.update({
                where: { clientsmsid },
                data: { status: 'failed' },
            });
        }

        throw new Error(error.response ? error.response.data : 'Failed to send SMS.');
    }
};



module.exports = { MpesaPaymentSettlement };
