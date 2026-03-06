const express = require('express');
const cors = require('cors');
const boardRoute = require('./routes/board');
const adminRoutes = require('./routes/admin');

const app = express();

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/board', boardRoute);
app.use('/api/admin', adminRoutes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});