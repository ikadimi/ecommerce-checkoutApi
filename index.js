require('dotenv').config();
const express = require('express');
const amqp = require('amqplib');
const Order = require('./models/order.model');
const PaymentService = require('./services/paymentService'); // Integrate with a payment provider

const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const CART_API_URL = process.env.CART_API_URL;
const AUTH_API_URL = process.env.AUTH_API_URL;

const app = express();
app.use(cookieParser());
app.use(express.json());
// Middleware
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
  });
app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL
}));

// app.post('/deliveryAddress', async (req, res) => {
    
// })

// app.post('/payment', async (req, res) => {

// });


async function publishEmail(mail) {
  try {
    console.log('Sending email request to queue...');
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    const queue = 'email_queue';

    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(mail)), { persistent: true });

    console.log('Email request sent to queue');
    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('Failed to send email request to queue:', error);
  }
}

function generateOrderConfirmationMail(order, user) {
  return {
    to: user.email,
    subject: 'Order Confirmation',
    html: `Thank you for your order. Your order ID is ${order._id}.`
  }
}

// Checkout Process
app.post('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { deliveryAddress, paymentMethod } = req.body;
    const headers = {
      'x-user-id': userId
    };
    
    // 1. Retrieve the cart
    const cartResponse = await axios.get(CART_API_URL, { headers });
    const cart = cartResponse.data;
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // 2. Validate Shipping Address
    if (!deliveryAddress) {
      return res.status(400).json({ message: 'Invalid shipping address' });
    }

    // 3. Process Payment
    const paymentResult = await PaymentService.processPayment(userId, cart.totalPrice, paymentMethod);
    if (!paymentResult.success) {
      return res.status(400).json({ message: 'Payment failed', error: paymentResult.error });
    }

    // 4. Create Order
    const order = new Order({
      userId,
      items: cart.items,
      deliveryAddress,
      paymentStatus: 'Paid',
      totalPrice: cart.totalPrice,
      status: 'Processing'
    });

    await order.save();

    // 5. Clear Cart after checkout
    try {
        await axios.delete(`${CART_API_URL}/clear`, { headers });
    } catch {
        return res.status(400).json({ message: 'Failed to clear cart' });
    }

    // 6. Send Order Confirmation Email
    const userResponse = await axios.get(`${AUTH_API_URL}/user/${userId}`); // Assuming you have a User model to retrieve user info
    const user = userResponse.data;

    if (user && user.email) {
      await publishEmail(generateOrderConfirmationMail(order, user)); // Pass user email
    }

    // 7. Return response to client
    res.status(200).json({
      message: 'Order placed successfully',
      orderId: order._id,
      order
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ message: 'Checkout failed', error: error.message });
  }
});


const url = process.env.DB_URL;
const dbName = process.env.DB_NAME;
mongoose.connect(`${url}/${dbName}`)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
