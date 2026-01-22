import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const mailOptions = {
      from: `"Ruta y Campo" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Recuperación de Contraseña - Ruta y Campo',
      html: this.getPasswordResetTemplate(userName, resetUrl)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error al enviar email:', error);
      throw new Error('Error al enviar el email de recuperación');
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
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            background-color: #16a34a;
            color: white;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          h1 {
            color: #16a34a;
            margin: 10px 0;
          }
          .content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background-color: #16a34a;
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: bold;
          }
          .button:hover {
            background-color: #15803d;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🚚</div>
            <h1>Ruta y Campo</h1>
          </div>
          
          <div class="content">
            <h2>Recuperación de Contraseña</h2>
            <p>Hola ${userName || 'Usuario'},</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Ruta y Campo.</p>
            <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong> Este enlace expirará en 1 hora por razones de seguridad.
            </div>
            
            <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
              <a href="${resetUrl}" style="color: #16a34a; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} Ruta y Campo. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default new EmailService();
