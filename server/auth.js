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
      if(!process.env.RESEND_API_KEY){
        console.error('[EMAIL] RESEND_API_KEY not set - cannot send email');
        throw new Error('Email service not configured');
      }

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      try {
        console.log(`[EMAIL] Sending password reset via Resend to ${user.email}...`);
        
        const urlObj = new URL(url);
        const token = urlObj.pathname.split('/').pop();
        const callbackURL = urlObj.searchParams.get('callbackURL') || '';
        const resetURL = `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/account/reset-password/${token}${callbackURL ? `?callbackURL=${encodeURIComponent(callbackURL)}` : ''}`;
        
        const { data, error } = await resend.emails.send({
          from: process.env.SMTP_FROM || 'noreply@dustin3dprint.com',
          to: user.email,
          subject: 'Reset Your Password',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                h2 { color: #333; margin-top: 0; }
                .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
                .button:hover { background-color: #0056b3; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
                .url-fallback { word-break: break-all; font-size: 12px; color: #666; margin-top: 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Reset Your Password</h2>
                <p>You requested to reset your password. Click the button below to set a new password:</p>
                <a href="${resetURL}" class="button">Reset Password</a>
                <p class="url-fallback">Or copy and paste this link into your browser:<br>${resetURL}</p>
                <div class="footer">
                  <p>This link will expire in 1 hour.</p>
                  <p>If you didn't request this password reset, you can safely ignore this email.</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
        
        if(error){
          console.error('[EMAIL] Resend error:', error);
          throw new Error(error.message || 'Failed to send email');
        }
        
        console.log('[EMAIL] Password reset email sent successfully via Resend:', data);
      } catch(error) {
        console.error('[EMAIL] Failed to send password reset email:', error);
        throw error;
      }
    },
  },
  emailVerification: {
    enabled: false,
    sendVerificationEmail: async ({ user, url }) => {
      if(!process.env.RESEND_API_KEY){
        console.error('[EMAIL] RESEND_API_KEY not set - cannot send email');
        throw new Error('Email service not configured');
      }

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
