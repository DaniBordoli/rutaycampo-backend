import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    this.transporter = null;
  }

  getTransporter() {
    if (['development', 'staging'].includes(process.env.NODE_ENV) && (!process.env.EMAIL_PASSWORD || process.env.EMAIL_PASSWORD === 'tu-app-password')) {
      console.log('⚠️  EMAIL_PASSWORD no configurado. Los emails no se enviarán.');
      console.log('💡 Para testing, el invitationUrl se mostrará en la respuesta del API.');
      return null;
    }
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const transporter = this.getTransporter();

    if (!transporter) {
      console.log(`📧 [MOCK] Email de recuperación para ${email}`);
      console.log(`🔗 Reset URL: ${resetUrl}`);
      return { success: true, mock: true };
    }

    const mailOptions = {
      from: `"Ruta y Campo" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Recuperación de Contraseña - Ruta y Campo',
      html: this.getPasswordResetTemplate(userName, resetUrl),
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../utils/email-assets/FavIcon.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error al enviar email:', error);
      throw new Error('Error al enviar el email de recuperación');
    }
  }

  async sendProducerInvitationEmail(email, invitationToken, producerName) {
    const invitationUrl = `${process.env.FRONTEND_PRODUCTORES_URL || 'http://localhost:5173'}/set-password/${invitationToken}`;
    const transporter = this.getTransporter();

    if (!transporter) {
      console.log(`📧 [MOCK] Email de invitación para ${email} (${producerName})`);
      console.log(`🔗 Invitation URL: ${invitationUrl}`);
      return { success: true, mock: true };
    }

    const mailOptions = {
      from: `"Ruta y Campo" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Bienvenido a Ruta y Campo - Configura tu Contraseña',
      html: this.getProducerInvitationTemplate(producerName, invitationUrl),
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '../utils/email-assets/FavIcon.png'),
          cid: 'logo'
        },
        {
          filename: 'background.png',
          path: path.join(__dirname, '../utils/email-assets/MailBackground.png'),
          cid: 'mailBackground'
        },
        {
          filename: 'check.svg',
          path: path.join(__dirname, '../utils/email-assets/Check.svg'),
          cid: 'checkIcon'
        },
        {
          filename: 'alert.png',
          path: path.join(__dirname, '../utils/email-assets/Alert.png'),
          cid: 'alertIcon'
        }
      ]
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email de invitación enviado a ${email}`);
      console.log(`📧 Message ID: ${info.messageId}`);
      return { success: true };
    } catch (error) {
      console.error('Error al enviar email de invitación:', error);
      throw new Error('Error al enviar el email de invitación');
    }
  }

  getPasswordResetTemplate(userName, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de Contraseña</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 540px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px 30px;
          }
          .logo {
            width: 60px;
            height: 60px;
            margin-bottom: 30px;
          }
          h1 {
            color: #1f2937;
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 20px 0;
          }
          p {
            color: #4b5563;
            font-size: 15px;
            margin: 0 0 15px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(to right, #37784C, #5F9C73);
            color: white !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 80px;
            font-weight: 600;
            font-size: 15px;
            margin: 10px 0 20px 0;
          }
          .link-fallback {
            color: #6b7280;
            font-size: 13px;
            margin-top: 15px;
            line-height: 1.5;
          }
          .link-fallback a {
            color: #16a34a;
            word-break: break-all;
          }
          .footer {
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="cid:logo" class="logo" alt="Logo Ruta y Campo" />
          
          <h1>Restablecé tu contraseña ahora</h1>
          
          <p>Hola, recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Si fuiste vos, hacé clic en el siguiente enlace para crear una nueva contraseña:</p>
          
          <a href="${resetUrl}" class="button">Restablecer contraseña</a>
          
          <p>Ante cualquier duda, estamos para ayudarte.</p>
          <p>Saludos, El equipo de Ruta y Campo.</p>
          
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>${new Date().getFullYear()} Ruta y Campo. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getProducerInvitationTemplate(producerName, invitationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a Ruta y Campo</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f3f4f6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 540px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px 30px;
          }
          .header-image {
            width: 100%;
            max-width: 540px;
            height: auto;
            display: block;
            margin: -40px -30px 30px -30px;
          }
          .logo {
            width: 60px;
            height: 60px;
            margin-bottom: 30px;
            margin-top: 20px;
          }
          h1 {
            color: #1f2937;
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 20px 0;
          }
          p {
            color: #4b5563;
            font-size: 15px;
            margin: 0 0 15px 0;
          }
          .features-box {
            background-color: #F1F8F3;
            border-radius: 24px;
            padding: 20px;
            margin: 25px 0;
          }
          .features-title {
            color: #45845C;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 15px 0;
          }
          .features-list {
            margin: 0;
            padding: 0;
            list-style: none;
          }
          .features-list li {
            color: #45845C;
            font-size: 15px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .check-icon {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
          }
          .instruction-text {
            color: #4b5563;
            font-size: 15px;
            margin: 20px 0 15px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(to right, #37784C, #5F9C73);
            color: white !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 80px;
            font-weight: 600;
            font-size: 15px;
            margin: 10px 0 20px 0;
          }
          .info-box {
            background-color: #EDF2F8;
            border-radius: 12px;
            padding: 15px;
            margin: 20px 0;
            display: flex;
            align-items: flex-start;
            gap: 10px;
          }
          .info-box p {
            color: #3590F3;
            font-size: 14px;
            margin: 0;
            flex: 1;
          }
          .alert-icon {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
            margin-top: 2px;
          }
          .link-fallback {
            color: #6b7280;
            font-size: 13px;
            margin-top: 15px;
            line-height: 1.5;
          }
          .link-fallback a {
            color: #16a34a;
            word-break: break-all;
          }
          .footer {
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="cid:mailBackground" class="header-image" alt="Ruta y Campo" />
          
          <img src="cid:logo" class="logo" alt="Logo Ruta y Campo" />
          
          <h1>¡Bienvenido a Ruta y Campo!</h1>
          
          <p>Hola ${producerName},</p>
          <p>Tu cuenta de productor ha sido creada exitosamente en nuestra plataforma.</p>
          
          <div class="features-box">
            <div class="features-title">¿Qué podés hacer en Ruta y Campo?</div>
            <ul class="features-list">
              <li><img src="cid:checkIcon" class="check-icon" alt="check" />Solicitar transporte de carga</li>
              <li><img src="cid:checkIcon" class="check-icon" alt="check" />Ver el estado de tus viajes en tiempo real</li>
              <li><img src="cid:checkIcon" class="check-icon" alt="check" />Hacer seguimiento GPS de tus envíos</li>
              <li><img src="cid:checkIcon" class="check-icon" alt="check" />Consultar el historial de viajes</li>
            </ul>
          </div>
          
          <p class="instruction-text">Para comenzar a utilizar el sistema, necesitás configurar tu contraseña haciendo clic en el siguiente botón:</p>
          
          <a href="${invitationUrl}" class="button">Configurar mi contraseña</a>
          
          <div class="link-fallback">
            Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
            <a href="${invitationUrl}">${invitationUrl}</a>
          </div>
          
          <div class="info-box">
            <img src="cid:alertIcon" class="alert-icon" alt="alert" />
            <p><strong>Este enlace expirará en 7 días.</strong> Si no configurás tu contraseña dentro de este período, deberás solicitar un nuevo enlace de invitación.</p>
          </div>
          
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>${new Date().getFullYear()} Ruta y Campo. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default new EmailService();
