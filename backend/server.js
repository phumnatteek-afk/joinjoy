const express = require('express');
const cors    = require('cors');
const path    = require('path');

const boardRoute        = require('./routes/board');
const adminRoutes       = require('./routes/admin');
const notificationRoutes = require('./routes/notification');
const homepageRoute     = require('./routes/homepage');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads',     express.static(path.join(__dirname, 'uploads')));
app.use('/userprofile', express.static(path.join(__dirname, 'userprofile')));

app.use('/api/board',         boardRoute);
app.use('/api/admin',         adminRoutes);
app.use('/api/notification',  notificationRoutes);
app.use('/api/user',          homepageRoute);
app.use('/api/trips',         homepageRoute);
app.use('/api/reviews',       homepageRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});