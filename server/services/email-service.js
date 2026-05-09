const nodemailer = require('nodemailer');

// Configure the transporter with SMTP settings from .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send a transactional email
 */
async function sendEmail(to, subject, text, html) {
    // If no SMTP user is configured, skip sending but log it
    if (!process.env.SMTP_USER) {
        console.log(`[Email Mock] To: ${to} | Subject: ${subject} | Body: ${text}`);
        return { mock: true };
    }

    try {
        const info = await transporter.sendMail({
            from: `"FitTraining" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            html: html || text.replace(/\n/g, '<br>')
        });
        console.log(`[Email Sent] ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('[Email Error]', error.message);
        throw error;
    }
}

/**
 * Specific template for new joiners
 */
async function sendWelcomeEmail(user, boxName) {
    const subject = `Bem-vindo ao FitTraining - ${boxName}`;
    const text = `Olá ${user.name}!\n\nA tua conta na box ${boxName} foi criada. O teu administrador irá validar o teu acesso em breve.\n\nBons treinos!`;
    return sendEmail(user.email, subject, text);
}

/**
 * Notification for box validation
 */
async function sendValidationEmail(user, boxName) {
    const subject = `Conta Validada - ${boxName}`;
    const text = `Olá ${user.name}!\n\nA tua conta na box ${boxName} foi validada. Já podes marcar as tuas aulas na aplicação!\n\nAté já!`;
    return sendEmail(user.email, subject, text);
}

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendValidationEmail
};
