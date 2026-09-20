const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/email');

const prisma = require('../lib/prisma');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não está definido. Define-o no .env antes de arrancar o servidor.');
}

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
 * Middleware to protect routes.
 *
 * O token só carrega o `userId`; o `role`, `boxId` e `boxValidated` são lidos
 * da BD a cada pedido. Assim os middlewares de isolamento multi-tenant
 * (requireSameBox & co.) têm sempre um `boxId` real, e uma mudança de role ou
 * de box tem efeito imediato em vez de esperar pela expiração do token (7d).
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.sendStatus(403);
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, role: true, boxId: true, boxValidated: true }
        });
        if (!user) return res.sendStatus(403);

        req.user = {
            userId: user.id,
            role: user.role,
            boxId: user.boxId,
            boxValidated: user.boxValidated
        };
        next();
    } catch (err) {
        console.error('[Auth] Falha ao carregar o utilizador do token:', err.message);
        res.status(500).json({ error: 'Erro de autenticação.' });
    }
}

/**
 * Autenticação opcional: preenche `req.user` quando o pedido traz um token
 * válido e segue em frente na mesma quando não traz (ou quando é inválido).
 * Serve rotas que funcionam anónimas mas ganham contexto com sessão iniciada —
 * por exemplo a partilha para a TV, que precisa de saber a quem pertence o
 * treino para depois poder registar o resultado no histórico.
 */
async function optionalAuthenticateToken(req, res, next) {
    if (!req.headers['authorization']) return next();
    let settled = false;
    const proceed = () => { if (!settled) { settled = true; next(); } };
    // Reaproveita o authenticateToken (mesma leitura de role/box da BD) mas
    // absorve as respostas de erro, transformando-as em "segue sem utilizador".
    const swallow = { sendStatus: proceed, status: () => ({ json: proceed, send: proceed, end: proceed }) };
    try {
        await authenticateToken(req, swallow, proceed);
    } catch (err) {
        proceed();
    }
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
    optionalAuthenticateToken,
    authorizeRoles
};
