const express = require('express');

const cors = require('cors');
const helmet = require('helmet'); // Import Helmet
require('dotenv').config();
const bodyParser = require('body-parser');
const customerRoutes = require('./routes/customer/customerRoutes.js');
const userRoutes = require('./routes/userRoute/userRoute.js');
const invoiceRoutes = require('./routes/invoices/invoiceRoute.js');
const mpesaRoute = require('./routes/mpesa/mpesaRoute.js');
const collectionRoute = require('./routes/collection/collectionRoute.js');
const sendSmsRoute = require('./routes/sms/sendSmsRoute.js');
const receiptRoute = require('./routes/receipt/receiptingRoute.js');
const paymentRoute = require('./routes/payment/paymentRoutes.js');
const statsRoute = require('./routes/stats/statsRoute.js');
const statsms = require('./routes/sms/statsmsRoute.js');
const uploadcustomers = require('./routes/fileUpload/uploadRoute.js');
const customerdetailsRoute = require('./routes/customer/customerDetailsRoute.js')
const smsBalanceRoute = require('./routes/sms/balance.js')
const reportsReoute  = require('./routes/reportRoutes/reportRoute.js')
const userManagementRoute = require('./routes/rolesRoute/roles.js')
const cookieParser = require('cookie-parser');

const permissionsRoutes = require('./routes/permision/permissionRoute.js')
const createTask = require('./routes/task/taskRoute.js')

const app = express();
const PORT = 3000;

app.use(cookieParser());
//app.use(verifyToken);
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

app.use(helmet());
app.use(cors({
    origin: '*', 
    credentials: true,
}));


// Use customer routes
app.use('/core', customerRoutes);
app.use('/core', userRoutes);
app.use('/core', sendSmsRoute);
app.use('/core', invoiceRoutes);
app.use('/core', mpesaRoute);
app.use('/core', collectionRoute);
app.use('/core', receiptRoute);
app.use('/core', paymentRoute);
app.use('/core', statsRoute);
app.use('/core', statsms);
app.use('/core', uploadcustomers); 
app.use('/core', customerdetailsRoute); 
app.use('/core', smsBalanceRoute); 
app.use('/core', reportsReoute); 
app.use('/core', userManagementRoute); 
app.use('/core', permissionsRoutes);
app.use('/core', createTask);


// Start the HTTP server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on:${PORT}`);
});

// Set server timeout
const timeoutDuration = 80000; // Set timeout duration in milliseconds (e.g., 60000 ms = 60 seconds)
server.setTimeout(timeoutDuration, () => {
  console.log(`Server timed out after ${timeoutDuration / 1000} seconds.`);
});
