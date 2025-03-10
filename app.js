const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const path = require('path');

// Load User model (assume this is in models/User.js)
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB (use your MongoDB URI here)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/resumeapp';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Set EJS templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'your_secret_key', // Replace with a secure key in production
  resave: false,
  saveUninitialized: false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      // In production, use hashed passwords!
      if (user.password !== password) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Middleware to protect routes
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Routes

// Home: Redirect based on authentication
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/resume');
  } else {
    res.redirect('/login');
  }
});

// Registration Routes
app.get('/register', (req, res) => {
  res.render('register', { message: req.flash('error') });
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'Please fill in all fields.');
    return res.redirect('/register');
  }
  try {
    let user = await User.findOne({ email });
    if (user) {
      req.flash('error', 'User already exists.');
      return res.redirect('/register');
    }
    user = new User({ email, password }); // Remember to hash passwords in production!
    await user.save();
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Registration failed.');
    res.redirect('/register');
  }
});

// Login Routes
app.get('/login', (req, res) => {
  res.render('login', { message: req.flash('error') });
});

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/resume',
    failureRedirect: '/login',
    failureFlash: true
  })
);

// Protected Resume Route
app.get('/resume', isAuthenticated, (req, res) => {
  // Render the resume page (resume.ejs) only for logged-in users
  res.render('resume', { user: req.user });
});

// Logout Route
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
