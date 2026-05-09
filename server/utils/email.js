const nodemailer = require('nodemailer');

/**
 * Configure Transporter
 * In a real environment, you should provide SMTP credentials via .env
 */
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send Password Reset Email
 */
async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    
    const mailOptions = {
        from: '"FitTraining" <noreply@fittraining.com>',
        to: email,
        subject: 'Recuperação de Password - FitTraining',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #6366f1;">Recuperação de Password</h2>
                <p>Recebemos um pedido para recuperar a tua password no FitTraining.</p>
                <p>Clica no botão abaixo para definires uma nova password. Este link é válido por 1 hora.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Password</a>
                </div>
                <p style="font-size: 0.8rem; color: #666;">Se não pediste este reset, podes ignorar este email com segurança.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 0.7rem; color: #999; text-align: center;">&copy; 2026 FitTraining App</p>
            </div>
        `
    };

    // If no credentials, log to console instead of trying to send
    if (!process.env.SMTP_USER) {
        console.log('--- MOCK EMAIL START ---');
        console.log(`To: ${email}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Reset URL: ${resetUrl}`);
        console.log('--- MOCK EMAIL END ---');
        return true;
    }

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Falha ao enviar email de recuperação.');
    }
}

module.exports = {
    sendPasswordResetEmail
};
