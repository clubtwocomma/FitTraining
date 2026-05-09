const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { sendPasswordResetEmail } = require('../utils/email');

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
 * Change Password (Authenticated)
 */
async function changePassword(userId, oldPassword, newPassword) {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) throw new Error('Utilizador não encontrado.');

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) throw new Error('Palavra-passe atual incorreta.');

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
    });

    return true;
}

/**
 * Request Password Reset
 */
async function requestPasswordReset(email) {
    const user = await prisma.user.findUnique({
        where: { email }
    });

    // We return true even if user doesn't exist for security (don't leak emails)
    if (!user) return true;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry }
    });

    await sendPasswordResetEmail(email, resetToken);
    return true;
}

/**
 * Reset Password with Token
 */
async function resetPassword(token, newPassword) {
    const user = await prisma.user.findFirst({
        where: {
            resetToken: token,
            resetTokenExpiry: { gt: new Date() }
        }
    });

    if (!user) {
        throw new Error('Token inválido ou expirado.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedNewPassword,
            resetToken: null,
            resetTokenExpiry: null
        }
    });

    return true;
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
    changePassword,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    authenticateToken,
    authorizeRoles
};
