const express = require('express');
const Order = require('./models/order.model');
const PaymentService = require('./services/paymentService'); // Integrate with a payment provider

const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const CART_API_URL = 'http://localhost:3002';

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
  origin: 'http://localhost:4200'
}));

// app.post('/deliveryAddress', async (req, res) => {
    
// })

// app.post('/payment', async (req, res) => {

// });

// Checkout Process
app.post('/', async (req, res) => {
  try {
    console.log('checkout biii')
    const userId = req.headers['x-user-id'];
    const { shippingAddress, paymentMethod } = req.body;
    const headers = {
      'x-user-id': userId
    }
    // 1. Retrieve user's cart
    
    const cartResponse = await axios.get(CART_API_URL, { headers });
    const cart = cartResponse.data;
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // 2. Validate Shipping Address
    if (!shippingAddress) {
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
      shippingAddress,
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
    // TODO: Send email

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

const url = 'mongodb://localhost:27017';
const dbName = 'ecommerce';
mongoose.connect(`${url}/${dbName}`)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = 3004;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
