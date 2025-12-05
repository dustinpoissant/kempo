import crypto from 'crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import db from './db/index.js';
import * as schema from './db/schema.js';
import { ac, superAdmin, admin, editor, contributor, subscriber } from './permissions.js';
import 'dotenv/config';

// Ensure crypto is available globally for Better Auth
if(!globalThis.crypto){
  globalThis.crypto = crypto.webcrypto;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const emailMode = process.env.EMAIL_MODE || 'mailpit';
      
      if(emailMode === 'production' && process.env.RESEND_API_KEY){
        // Production: use Resend for reliable email delivery
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        try {
          console.log(`[EMAIL] Sending password reset via Resend to ${user.email}...`);
          const { data, error } = await resend.emails.send({
            from: process.env.SMTP_FROM || 'noreply@dustin3dprint.com',
            to: user.email,
            subject: 'Reset Your Password',
            html: `
              <h2>Reset Your Password</h2>
              <p>Click the link below to reset your password:</p>
              <a href="${url}">${url}</a>
            `,
          });
          
          if(error){
            console.error('[EMAIL] Resend error:', error);
            throw new Error(error.message || 'Failed to send email');
          }
          
          console.log('[EMAIL] Password reset email sent successfully via Resend:', data);
          return;
        } catch(error) {
          console.error('[EMAIL] Failed to send password reset email:', error);
          throw error;
        }
      }
      
      // Fallback to nodemailer for development/other modes
      const nodemailer = await import('nodemailer');
      let transporter;
      
      if(process.platform === 'win32'){
        // Windows development
        if(emailMode === 'smtp'){
          // Use SMTP relay container for real email sending
          transporter = nodemailer.default.createTransport({
            host: 'localhost',
            port: 1026,
            secure: false,
            auth: {
              user: 'noreply',
              pass: 'noreply',
            },
            tls: {
              rejectUnauthorized: false,
            },
          });
        } else {
          // Use Mailpit for testing (default)
          transporter = nodemailer.default.createTransport({
            host: 'localhost',
            port: 1025,
            secure: false,
            auth: {
              user: 'test',
              pass: 'test',
            },
          });
        }
      } else {
        // Linux production: use sendmail (like PHP mail())
        transporter = nodemailer.default.createTransport({
          sendmail: true,
          newline: 'unix',
          path: '/usr/sbin/sendmail',
        });
      }
      
      try {
        console.log(`[EMAIL] Sending password reset to ${user.email}...`);
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@example.com',
          to: user.email,
          subject: 'Reset Your Password',
          html: `
            <h2>Reset Your Password</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${url}">${url}</a>
            <p>This link will expire in 1 hour.</p>
          `,
        });
        console.log(`[EMAIL] Password reset email sent successfully:`, info);
      } catch(error) {
        console.error('[EMAIL] Failed to send password reset email:', error);
        throw error;
      }
    },
  },
  emailVerification: {
    enabled: false,
    sendVerificationEmail: async ({ user, url }) => {
      const emailMode = process.env.EMAIL_MODE || 'mailpit';
      
      if(emailMode === 'production' && process.env.RESEND_API_KEY){
        // Production: use Resend for reliable email delivery
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        try {
          console.log(`[EMAIL] Sending email verification via Resend to ${user.email}...`);
          const { data, error } = await resend.emails.send({
            from: process.env.SMTP_FROM || 'noreply@dustin3dprint.com',
            to: user.email,
            subject: 'Verify Your Email',
            html: `
              <h2>Verify Your Email</h2>
              <p>Click the link below to verify your email address:</p>
              <a href="${url}">${url}</a>
            `,
          });
          
          if(error){
            console.error('[EMAIL] Resend error:', error);
            throw new Error(error.message || 'Failed to send email');
          }
          
          console.log('[EMAIL] Email verification sent successfully via Resend:', data);
          return;
        } catch(error) {
          console.error('[EMAIL] Failed to send email verification:', error);
          throw error;
        }
      }
      
      // Fallback to nodemailer for development/other modes
      const nodemailer = await import('nodemailer');
      let transporter;
      
      if(process.platform === 'win32'){
        // Windows development
        if(emailMode === 'smtp'){
          // Use SMTP relay container for real email sending
          transporter = nodemailer.default.createTransport({
            host: 'localhost',
            port: 1026,
            secure: false,
            auth: {
              user: 'noreply',
              pass: 'noreply',
            },
            tls: {
              rejectUnauthorized: false,
            },
          });
        } else {
          // Use Mailpit for testing (default)
          transporter = nodemailer.default.createTransport({
            host: 'localhost',
            port: 1025,
            secure: false,
            auth: {
              user: 'test',
              pass: 'test',
            },
          });
        }
      } else {
        // Linux production: use sendmail (like PHP mail())
        transporter = nodemailer.default.createTransport({
          sendmail: true,
          newline: 'unix',
          path: '/usr/sbin/sendmail',
        });
      }
      
      try {
        console.log(`[EMAIL] Sending email verification to ${user.email}...`);
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@example.com',
          to: user.email,
          subject: 'Verify Your Email',
          html: `
            <h2>Verify Your Email</h2>
            <p>Click the link below to verify your email address:</p>
            <a href="${url}">${url}</a>
          `,
        });
        console.log(`[EMAIL] Email verification sent successfully:`, info);
      } catch(error) {
        console.error('[EMAIL] Failed to send email verification:', error);
        throw error;
      }
    },
  },
  socialProviders: {
    // Add social providers here as needed
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET,
    // },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:8083',
  plugins: [
    organization({
      ac,
      roles: {
        superAdmin,
        admin,
        editor,
        contributor,
        subscriber
      },
      allowUserToCreateOrganization: false
    })
  ]
});
