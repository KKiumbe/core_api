// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser'); // Import body-parser
const customerRoutes = require('./routes/customerRoutes.js'); // Import the customer routes
const userRoutes = require('./routes/userRoute/userRoute.js'); // Import the customer routes
const invoiceRoutes = require('./routes/invoices/invoiceRoute.js');
const mpesaRoute = require('./routes/mpesa/mpesaRoute.js')
const cookieParser = require('cookie-parser');


const app = express();
const PORT = process.env.PORT || 5000;


app.use(cookieParser());

app.use(cors());
app.use(bodyParser.json()); // Use body-parser for JSON parsing
app.use(express.json()); // Alternatively, you can keep this line if needed

// MongoDB Connection

// MongoDB Connection
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('MongoDB connection error:', error));

// Use customer routes
app.use('/api', customerRoutes); // Use the customer routes under the '/api' prefix
app.use('/api', userRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', mpesaRoute);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
