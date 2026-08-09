// Made by Nori (lyfe-ui) - No credits needed, selling/distribution is not permitted
// https://github.com/lyfe-ui

const express = require('express');
const CryptoJS = require('crypto-js');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const { v4: uuidv4 } = require('uuid');
const io = socketIo(server, {
  transports: ['websocket'],
});

const mongoose = require('mongoose');
const {Schema} = require('mongoose');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');

app.use(express.json());

app.use(cors());

mongoose.connect('inputstringhere', { useNewUrlParser: true }) // add info
const db = mongoose.connection
db.on('error', (error) => console.error(error))
db.once('open', () => console.log('Connected to database.'));

const mmIdentify = new mongoose.Schema({
    crypto: { type: String, required: true },
    identifier: { type: String, required: true },
    address: { type: String, required: true, default: "0" },
    status: { type: String, required: true, default: "0" },
    channelId: {type: String, required: true, default: "0"},
    sender: { type: String, required: true, default: "0"},
    receiver: { type: String, required: true, default: "0"},
    creatorUserId: {type: String, required: true, default: "0"},
    otherUserId: {type: String, required: true, default: "0"},
    amountInUsd: { type: Number, required: true, default: "0"},
    amountInCrypto: {type: Number, required: true, default: "0"},
    createdAt: { type: Date, required: true }
})

const ticketSchema = new mongoose.Schema({
    category: {
      type: String,
      required: true,
      enum: ['btc', 'ltc', 'eth', 'doge', 'usdt'],
    },
    ticketCount: {
      type: Number,
      default: 0,
    },
  });

const confirmationOne = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    default: "0",
  },
  sender: {
    type: String,
    required: true,
    default: "0",
  },
  receiver: {
    type: String,
    required: true,
    default: "0",
  },
});

const mmPayment = new mongoose.Schema({
  crypto: { type: String, required: true },
  address: { type: String, required: true },
  orderId: { type: String, required: true },
  trackId: { type: String, required: true },
  channelId: {type: String, required: true },
  sender: { type: String, required: true },
})
  
const PaymentMM = mongoose.model('mmPayment', mmPayment)
const ConfirmationOne = mongoose.model('confirmationOne', confirmationOne);
const Ticket = mongoose.model('ticketCount', ticketSchema);
const IdentifyMM = mongoose.model('escrowTicket', mmIdentify)

app.post('/utils/oxa-callback', async (req, res)=> {
  const status = req.body.status;
  const txId = req.body.txId;
  const trackId = req.body.trackId;

  console.log(req.body)
  
  let mmExchanger = await PaymentMM.findOne({ trackId: `${trackId}` })

  let confirmaddy = mmExchanger.address
  let mmExchange = await IdentifyMM.findOne({ address: `${confirmaddy}` })

  if (status.toLowerCase() == "failed") {
    const channelIdFromDB = mmExchange.channelId;
    const errorMessage = "invalid_payment";

    io.emit('payment-error', {
      channelId: channelIdFromDB,
      error: errorMessage
    });

    return res.status(200).json({ status: "fail", error: errorMessage});
  } else if (status.toLowerCase() == "expired") {
    const channelIdFromDB = mmExchange.channelId;
    const errorMessage = "payment_expired_no_payment_identified";

    io.emit('payment-error', {
      channelId: channelIdFromDB,
      error: errorMessage
    });

    return res.status(200).json({ status: "fail", error: errorMessage});
  } else if (status.toLowerCase() == "confirming") {
    const channelIdFromDB = mmExchange.channelId;
    const Message = "processing_payment";

    io.emit('payment-processing', {
      channelId: channelIdFromDB,
      message: Message,
      txId: txId,
    });

    return res.status(200).json({ status: "processing", message: Message});
  } else if (status.toLowerCase() == "paid") {
    const channelIdFromDB = mmExchange.channelId;
    const Message = "payment_made";

    io.emit('payment-confirmed', {
      channelId: channelIdFromDB,
      message: Message,
      txId: txId,
    });

    return res.status(200).json({ status: "confirmed", message: Message});
  }
});

app.get('/', async (req, res) => {
  res.status(200).json({ status: 'success', message: 'Middleman Service - v1.0' });
});

io.on('connection', socket => {
  console.log(socket.id);
});

server.listen(4000, () => {
  console.log(`Server is running on port 4000`);
});
