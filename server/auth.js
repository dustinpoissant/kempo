import crypto from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
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
        
        const template = await readFile(
          join(process.cwd(), 'templates', 'emails', 'reset-password.html'),
          'utf-8'
        );
        const emailHtml = template.replace(/\{\{RESET_URL\}\}/g, resetURL);
        
        const { data, error } = await resend.emails.send({
          from: process.env.SMTP_FROM || 'noreply@dustin3dprint.com',
          to: user.email,
          subject: 'Reset Your Password',
          html: emailHtml,
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
        
        const template = await readFile(
          join(process.cwd(), 'templates', 'emails', 'verify-email.html'),
          'utf-8'
        );
        const emailHtml = template.replace(/\{\{VERIFY_URL\}\}/g, url);
        
        const { data, error } = await resend.emails.send({
          from: process.env.SMTP_FROM || 'noreply@dustin3dprint.com',
          to: user.email,
          subject: 'Verify Your Email',
          html: emailHtml,
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
