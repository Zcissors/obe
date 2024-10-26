const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
require('dotenv').config();
const axios = require('axios'); 
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
app.use(express.static('public'));

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
        console.log('Login from: ', profile.id, profile.displayName,);
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
    res.send(`
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Steam Login - CS2 Inventory Viewer</title>
    <link rel="icon" type="image/x-icon" href="icons/logo.svg">
    <style>
        
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#66c0f4" opacity="0.2"/>
                <path d="M50 20c-16.569 0-30 13.431-30 30 0 16.569 13.431 30 30 30 16.569 0 30-13.431 30-30 0-16.569-13.431-30-30-30zm0 5c13.785 0 25 11.215 25 25s-11.215 25-25 25-25-11.215-25-25 11.215-25 25-25z" fill="#66c0f4"/>
                <path d="M65 50H35M50 35v30" stroke="#66c0f4" stroke-width="5" stroke-linecap="round"/>
            </svg>
        </div>

        <h1>CS2 Inventory Viewer</h1>
        <p>View and manage your CS2 inventory with ease. Sign in through Steam to get started.</p>

        <a href="/auth/steam" class="login-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l7.29-7.29c.94-.94.94-2.48 0-3.42L12 2z"/>
                <path d="M7 7h.01"/>
            </svg>
            Login with Steam
        </a>

        <div class="features">
            <div class="feature">
                <h3>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                    Inventory Overview
                </h3>
                <p>View your entire CS2 inventory in one place with detailed item information.</p>
            </div>

            <div class="feature">
                <h3>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20V10"/>
                        <path d="M18 20V4"/>
                        <path d="M6 20v-4"/>
                    </svg>
                    Item Statistics
                </h3>
                <p>Track your inventory value and see detailed statistics about your items.</p>
            </div>

            <div class="feature">
                <h3>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                    </svg>
                    Quick Search
                </h3>
                <p>Easily search and filter through your inventory to find specific items.</p>
            </div>
        </div>

        <footer>
            <p>© 2024 CS2 Inventory Viewer. Not affiliated with Valve Corporation.</p>
        </footer>
    </div>
</body>
</html>
        `)
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

// CS2 Inventory fetch function
async function fetchCS2Inventory(steamId) {
    try {
        const response = await axios.get(`https://steamcommunity.com/inventory/${steamId}/730/2`);
        return response.data?.descriptions || [];
    } catch (error) {
        console.error('Error fetching CS2 inventory:', error);
        return [];
    }
}



// Helper function to get rarity color and name
function getRarityInfo(tags) {
    const rarityColors = {
        'Contraband': '#e4ae39',    // Gold
        'Covert': '#eb4b4b',        // Red
        'Classified': '#d32ce6',    // Pink
        'Restricted': '#8847ff',    // Purple
        'Mil-Spec Grade': '#4b69ff', // Blue
        'Industrial Grade': '#5e98d9', // Light Blue
        'Consumer Grade': '#b0c3d9'  // Gray
    };

    const rarityTag = tags?.find(tag => tag.category === 'Rarity');
    if (!rarityTag) return { color: '#b0c3d9', name: 'Consumer Grade' };

    return {
        color: rarityColors[rarityTag.localized_tag_name] || '#b0c3d9',
        name: rarityTag.localized_tag_name
    };
}

// Update the inventory fetch function (unchanged)
async function fetchCS2Inventory(steamId) {
    try {
        const response = await axios.get(`https://steamcommunity.com/inventory/${steamId}/730/2`);
        return response.data?.descriptions || [];
    } catch (error) {
        console.error('Error fetching CS2 inventory:', error);
        return [];
    }
}

// Helper function to get exterior wear color
function getWearColor(exterior) {
    const wearColors = {
        'Factory New': '#5e98d9',
        'Minimal Wear': '#7fd77f',
        'Field-Tested': '#ffd700',
        'Well-Worn': '#ffa500',
        'Battle-Scarred': '#ff4040'
    };
    for (const [wear, color] of Object.entries(wearColors)) {
        if (exterior.includes(wear)) return color;
    }
    return '#ffffff';
}

app.get('/profile/:steamid', isAuthenticated, async (req, res) => {
    if (req.user.id !== req.params.steamid) {
        return res.redirect(`/profile/${req.user.id}`);
    }

    const profile = req.user._json;
    const avatarUrl = profile.avatarmedium ? profile.avatarmedium.replace('http://', 'https://') : '/default-avatar.png';
    
    // Fetch CS2 inventory
    const inventory = await fetchCS2Inventory(req.params.steamid);
    
    const profilePage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'self' steamcommunity.com; img-src 'self' https: data: steamcdn-a.akamaihd.net *.steamcommunity.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';">
            <link rel="icon" type="image/x-icon" href="/icons/logo.svg">
            <title>${profile.personaname}'s Profile</title>
            <link rel="stylesheet" href="/styles.css">
            
        </head>
        <body>
            <header class="top-bar">
                <div class="profile-container">
                    <div class="profile-image">
                        <img src="${avatarUrl}" alt="Steam Avatar" onerror="this.src='/default-avatar.png';">
                    </div>
                    <div class="profile-info">
                        <div class="profile-name">${profile.personaname}</div>
                        <div class="profile-status">${getPlayerStatus(profile.personastate)}</div>
                    </div>
                </div>
                <nav class="nav-links">
                    <a href="${profile.profileurl}" target="_blank" rel="noopener noreferrer">Steam Profile</a>
                    <a href="/logout" class="logout-btn">Logout</a>
                </nav>
            </header>

            <main class="inventory-container">
                <div class="inventory-header">
                    <h2>CS2 Inventory</h2>
                </div>
                <div class="inventory-grid">
                    ${inventory.map((item, index) => {
                        const exterior = item.descriptions?.find(desc => desc.value.includes('Exterior:'))?.value || '';
                        const { color: rarityColor, name: rarityName } = getRarityInfo(item.tags);
                        
                        return `
                            <div class="inventory-item" 
                                onclick="showItemDetails(${index})"
                                style="--rarity-color: ${rarityColor}">
                                <div class="item-image-container">
                                    <img src="https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}" 
                                        alt="${item.name || 'CS2 Item'}"
                                        onerror="this.src='/default-item.png';">
                                </div>
                                <div class="item-info">
                                    <span class="item-name">${item.name || 'Unknown Item'}</span>
                                    ${exterior ? `
                                        <span class="item-exterior" style="color: ${getWearColor(exterior)}">
                                            ${exterior.replace('Exterior: ', '')}
                                        </span>
                                    ` : ''}
                                    <div class="rarity-name">${rarityName}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${inventory.length === 0 ? '<div class="no-items">No items found in inventory</div>' : ''}
                </div>
            </main>

            <!-- Modal -->
            <div class="modal-overlay" id="modalOverlay" onclick="hideItemDetails()"></div>
            <div class="modal" id="itemModal">
                <button class="close-button" onclick="hideItemDetails()">×</button>
                <div class="modal-content" id="modalContent"></div>
            </div>

        </body>
        <script>
                const inventory = ${JSON.stringify(inventory)};

                function showItemDetails(index) {
                    const item = inventory[index];
                    if (!item) return;

                    const modalContent = document.getElementById('modalContent');
                    const exterior = item.descriptions?.find(desc => desc.value.includes('Exterior:'))?.value || '';
                    const description = item.descriptions?.find(desc => desc.value.includes('"'))?.value || '';
                    const collection = item.descriptions?.find(desc => desc.color === '9da1a9')?.value || '';
                    const { color: rarityColor, name: rarityName } = getRarityInfo(item.tags);

                    modalContent.innerHTML = \`
                        <div class="modal-header">
                            <img class="modal-image" 
                                src="https://steamcommunity-a.akamaihd.net/economy/image/\${item.icon_url}" 
                                alt="\${item.name || 'CS2 Item'}"
                                onerror="this.src='/default-item.png';">
                            <div class="modal-info">
                                <div class="modal-rarity" style="color: \${rarityColor}">\${rarityName}</div>
                                <div class="modal-name">\${item.name || 'Unknown Item'}</div>
                                \${exterior ? \`
                                    <div class="modal-exterior" style="color: \${getWearColor(exterior)}">
                                        \${exterior.replace('Exterior: ', '')}
                                    </div>
                                \` : ''}
                                \${collection ? \`
                                    <div class="modal-collection">\${collection}</div>
                                \` : ''}
                            </div>
                        </div>
                        \${description ? \`
                            <div class="modal-description">
                                \${description.split('\\n').map(line => \`<p>\${line}</p>\`).join('')}
                            </div>
                        \` : ''}
                    \`;

                    


                    document.getElementById('modalOverlay').classList.add('show');
                    document.getElementById('itemModal').classList.add('show');
                    document.body.style.overflow = 'hidden';
                }

                function hideItemDetails() {
                    document.getElementById('modalOverlay').classList.remove('show');
                    document.getElementById('itemModal').classList.remove('show');
                    document.body.style.overflow = '';
                }
            </script>
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
