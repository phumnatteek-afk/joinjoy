const express = require('express');
const cors = require('cors');
const boardRoute = require('./routes/board');

const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notification');

const app = express();

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/board', boardRoute);
app.use('/api/admin', adminRoutes);
app.use('/api/notification', notificationRoutes);

// homepage
const homepageRoute = require('./routes/homepage');
app.use('/api/user',  homepageRoute);
app.use('/api/trips', homepageRoute);
app.use('/api/reviews', homepageRoute);
app.use('/uploads',     express.static(path.join(__dirname, 'uploads')));
app.use('/userprofile', express.static(path.join(__dirname, 'userprofile')));  

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});