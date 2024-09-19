const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      productId: { type: String, ref: 'Product', required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }  // Store price at time of order
    }
  ],
  deliveryAddress: {
    name: String,
    address: String,
    city: String,
    postalCode: String,
    country: String
  },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Failed'], required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'], required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
