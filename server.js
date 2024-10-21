const express = require('express');
const https = require('https'); // Import https module
const fs = require('fs'); // Import fs module
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const customerRoutes = require('./routes/customerRoutes.js');
const userRoutes = require('./routes/userRoute/userRoute.js');
const invoiceRoutes = require('./routes/invoices/invoiceRoute.js');
const mpesaRoute = require('./routes/mpesa/mpesaRoute.js');
const collectionRoute = require('./routes/collection/collectionRoute.js');
const sendtoGroup = require('./routes/sms/sendSms.js');
const receiptRoute = require('./routes/receipt/receiptingRoute.js');
const paymentRoute = require('./routes/payment/paymentRoutes.js');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// SSL Options
const sslOptions = {
    key: fs.readFileSync('/taqa/API/server.key'),
    cert: fs.readFileSync('/taqa/API/server.crt'),
};

app.use(cookieParser());
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// MongoDB Connection
mongoose
    .connect(process.env.DATABASE_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('MongoDB connection error:', error));

// Use customer routes
app.use('/api', customerRoutes);
app.use('/api', userRoutes);
app.use('/api', sendtoGroup);
app.use('/api', invoiceRoutes);
app.use('/api', mpesaRoute);
app.use('/api', collectionRoute);
app.use('/api', receiptRoute);
app.use('/api', paymentRoute);

// Start the HTTPS server
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});
