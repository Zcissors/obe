const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');
require('dotenv').config();

// Initialize express app
const app = express();

// Security middleware configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Changed to false for better security
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true, // Prevents XSS attacks
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

// Configure session and passport
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Passport configuration
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Steam Strategy configuration
const steamStrategyConfig = {
    returnURL: `${process.env.APP_URL || 'http://localhost:3000'}/auth/steam/return`,
    realm: process.env.APP_URL || 'http://localhost:3000',
    apiKey: process.env.STEAM_API_KEY
};

passport.use(new SteamStrategy(steamStrategyConfig, (identifier, profile, done) => {
    // Log profile data in development only
    if (process.env.NODE_ENV !== 'production') {
        console.log('Steam Profile:', profile);
    }
    profile.identifier = identifier;
    return done(null, profile);
}));

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
};

// Route handlers
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/auth/steam',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);

app.get('/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect(`/profile/${req.user.id}`);
    }
);

app.get('/profile/:steamid', isAuthenticated, (req, res) => {
    // Verify the requested profile matches the authenticated user
    if (req.user.id !== req.params.steamid) {
        return res.redirect(`/profile/${req.user.id}`);
    }

    const profile = req.user._json;
    
    // Ensure avatar URLs are using HTTPS
    const avatarUrl = profile.avatarmedium ? profile.avatarmedium.replace('http://', 'https://') : '/default-avatar.png';
    
    // Add error handling for avatar loading
    const profilePage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data: steamcdn-a.akamaihd.net *.steamcommunity.com; style-src 'self' 'unsafe-inline';">
            <title>${profile.personaname}'s Profile</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            <div class="profile-page">
                <nav class="navigation">
                    <a href="/logout" class="logout-btn">Logout</a>
                </nav>
                <div class="profile-card">
                    <div class="profile-header">
                        <div class="profile-name">${profile.personaname}</div>
                        <div class="profile-image">
                            <img 
                                src="${avatarUrl}" 
                                alt="Steam Avatar"
                                onerror="this.onerror=null; this.src='/default-avatar.png';"
                            />
                        </div>
                    </div>
                    <div class="profile-details">
                        <p>Steam ID: ${req.params.steamid}</p>
                        <p><a href="${profile.profileurl}" target="_blank" rel="noopener noreferrer">View Steam Profile</a></p>
                        ${profile.realname ? `<p>Name: ${profile.realname}</p>` : ''}
                        <p>Status: ${getPlayerStatus(profile.personastate)}</p>
                        <!-- For debugging -->
                        ${process.env.NODE_ENV === 'development' ? `
                            <details>
                                <summary>Debug Info</summary>
                                <pre>${JSON.stringify({ 
                                    originalAvatarUrl: profile.avatarmedium,
                                    modifiedAvatarUrl: avatarUrl,
                                    profileData: profile
                                }, null, 2)}</pre>
                            </details>
                        ` : ''}
                    </div>
                </div>
            </div>
            <script>
                // Add image load error handling
                document.querySelector('.profile-image img').addEventListener('error', function() {
                    console.error('Failed to load avatar image');
                    this.src = '/default-avatar.png';
                });
            </script>
        </body>
        </html>
    `;
    res.send(profilePage);
});

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// Helper function to get player status
function getPlayerStatus(state) {
    const states = {
        0: 'Offline',
        1: 'Online',
        2: 'Busy',
        3: 'Away',
        4: 'Snooze',
        5: 'Looking to Trade',
        6: 'Looking to Play'
    };
    return states[state] || 'Unknown';
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});