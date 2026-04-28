const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Register a new user
 */
async function registerUser(email, password, name, role = 'ATHLETE', boxId = null) {
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
                boxId: boxId ? parseInt(boxId) : null,
                boxValidated: false // Needs manager approval
            }
        });

        // Don't return password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    } catch (error) {
        if (error.code === 'P2002') {
            throw new Error('Email já em uso.');
        }
        throw error;
    }
}

/**
 * Login user and return token
 */
async function loginUser(email, password) {
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        throw new Error('Utilizador não encontrado.');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        throw new Error('Palavra-passe incorreta.');
    }

    const token = jwt.sign(
        { userId: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
}

/**
 * Middleware to protect routes
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

/**
 * Middleware to restrict to Coaches/Admins
 */
function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acesso negado: Permissões insuficientes.' });
        }
        next();
    };
}

/**
 * Update user profile (JSON data)
 */
async function updateProfile(userId, profileData) {
    const user = await prisma.user.update({
        where: { id: userId },
        data: { profile: profileData }
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

module.exports = {
    registerUser,
    loginUser,
    updateProfile,
    authenticateToken,
    authorizeRoles
};
