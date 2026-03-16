import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: 'admin@rutaycampo.com', pass: 'pjwm qgba rijy jieb' }
});

try {
  const info = await transporter.sendMail({
    from: '"Ruta y Campo" <admin@rutaycampo.com>',
    to: 'd.c.bordoli@gmail.com',
    subject: 'Test email Ruta y Campo',
    text: 'Si recibis esto, el email funciona correctamente.'
  });
  console.log('✅ Enviado:', info.messageId);
} catch (err) {
  console.error('❌ Error:', err.message, '| code:', err.code);
}
