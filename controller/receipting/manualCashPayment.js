const manualCashPayment = async (req, res) => {
    const { customerId, totalAmount, modeOfPayment, paidBy, paymentId } = req.body;

    // Validate required fields
    if (!customerId || !totalAmount || !modeOfPayment || !paidBy) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        // Step 1: Retrieve the customer
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found.' });
        }

        // Step 2: Create or update the payment
        let updatedPayment;
        if (paymentId) {
            // If paymentId is provided, update the existing payment
            updatedPayment = await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    amount: totalAmount,
                    modeOfPayment: modeOfPayment,
                    receipted: true,
                    createdAt: new Date(),
                },
            });
        } else {
            // If no paymentId is provided, create a new payment
            updatedPayment = await prisma.payment.create({
                data: {
                    amount: totalAmount,
                    modeOfPayment: modeOfPayment,
                    receipted: true,
                    createdAt: new Date(),
                },
            });
        }

        // Generate a unique receipt number
        const receiptNumber = generateReceiptNumber();

        // Step 3: Create the receipt
        const receipt = await prisma.receipt.create({
            data: {
                customerId: customerId,
                amount: totalAmount,
                modeOfPayment: modeOfPayment,
                receiptNumber: receiptNumber,
                paymentId: updatedPayment.id, // Link the newly created/updated payment
                paidBy: paidBy,
                createdAt: new Date(),
            },
        });

        // Update the customer's closing balance
        const newClosingBalance = customer.closingBalance - totalAmount;
        await prisma.customer.update({
            where: { id: customerId },
            data: { closingBalance: newClosingBalance },
        });

        return res.status(201).json({
            message: 'Payment and receipt created successfully.',
            receipt,
            updatedPayment,
            newClosingBalance,
        });
    } catch (error) {
        console.error('Error creating manual cash payment:', error);
        res.status(500).json({ error: 'Failed to create manual cash payment.', details: error.message });
    }
};
