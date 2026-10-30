import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { emailStylesheet, emailTemplateStyle } from '../../db/schema.js';

/*
  Email stylesheets: the CSS an email is drawn with, kept in the database by name and chosen per template. The `default` one is
  kempo's own (packaged as app-templates/email-styles/default.css), is made when the server starts, and cannot be deleted. A template
  with no choice uses `default`. The CSS is filtered for what mail clients drop, and cut down to what the email uses, when it is
  rendered (see renderEmailTemplate), so a stylesheet can hold more than any one email needs.
*/
export const DEFAULT_STYLESHEET = 'default';
const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
const PACKAGED = join(dirname(fileURLToPath(import.meta.url)), '../../../app-templates/email-styles/default.css');

const packagedCss = () => readFile(PACKAGED, 'utf8');

/* Makes the default stylesheet if it is missing. Its CSS is the packaged file; a site that has edited it keeps its edits. */
export const ensureDefaultStylesheet = async () => {
  try {
    const now = new Date();
    const [row] = await db.insert(emailStylesheet)
      .values({ name: DEFAULT_STYLESHEET, description: 'Kempo\'s light theme, in properties mail clients keep', css: await packagedCss(), createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning({ name: emailStylesheet.name });
    return [null, { added: row ? [DEFAULT_STYLESHEET] : [] }];
  } catch(error) {
    return [{ code: 500, msg: `The default email stylesheet could not be made: ${error.message}` }, null];
  }
};

/* Every stylesheet without its CSS, default first, then by name. */
export const listStylesheets = async () => {
  try {
    const rows = await db.select({ name: emailStylesheet.name, description: emailStylesheet.description, createdAt: emailStylesheet.createdAt, updatedAt: emailStylesheet.updatedAt }).from(emailStylesheet);
    rows.sort((a, b) => (a.name === DEFAULT_STYLESHEET ? -1 : b.name === DEFAULT_STYLESHEET ? 1 : a.name.localeCompare(b.name)));
    return [null, rows.map(row => ({ ...row, builtIn: row.name === DEFAULT_STYLESHEET }))];
  } catch(error) {
    return [{ code: 500, msg: 'The email stylesheets could not be read' }, null];
  }
};

/* One stylesheet with its CSS. The default one is read from the packaged file when its row is somehow missing. */
export const getStylesheet = async name => {
  try {
    const [row] = await db.select().from(emailStylesheet).where(eq(emailStylesheet.name, name)).limit(1);
    if(row) return [null, { ...row, builtIn: name === DEFAULT_STYLESHEET }];
    if(name === DEFAULT_STYLESHEET) return [null, { name, description: '', css: await packagedCss(), builtIn: true }];
    return [{ code: 404, msg: 'That email stylesheet does not exist' }, null];
  } catch(error) {
    if(name === DEFAULT_STYLESHEET) return [null, { name, description: '', css: await packagedCss(), builtIn: true }];
    return [{ code: 500, msg: 'The email stylesheet could not be read' }, null];
  }
};

export const createStylesheet = async ({ name, description = '', css = '' } = {}) => {
  if(typeof name !== 'string' || !NAME.test(name)) return [{ code: 400, msg: 'A stylesheet name is lowercase letters, digits and dashes, starting with a letter or digit' }, null];
  if(typeof css !== 'string') return [{ code: 400, msg: 'The CSS must be text' }, null];
  try {
    const now = new Date();
    const [row] = await db.insert(emailStylesheet).values({ name, description: String(description).slice(0, 500), css, createdAt: now, updatedAt: now }).returning();
    return [null, row];
  } catch(error) {
    if(error.code === '23505' || error.cause?.code === '23505') return [{ code: 409, msg: `A stylesheet called ${name} already exists` }, null];
    return [{ code: 500, msg: 'The stylesheet could not be saved' }, null];
  }
};

export const updateStylesheet = async (name, { description, css } = {}) => {
  if(css !== undefined && typeof css !== 'string') return [{ code: 400, msg: 'The CSS must be text' }, null];
  const changes = { updatedAt: new Date() };
  if(description !== undefined) changes.description = String(description).slice(0, 500);
  if(css !== undefined) changes.css = css;
  try {
    const [row] = await db.update(emailStylesheet).set(changes).where(eq(emailStylesheet.name, name)).returning();
    return row ? [null, row] : [{ code: 404, msg: 'That email stylesheet does not exist' }, null];
  } catch(error) {
    return [{ code: 500, msg: 'The stylesheet could not be saved' }, null];
  }
};

/* Deleting a stylesheet puts the templates that used it back on the default one. The default cannot be deleted. */
export const deleteStylesheet = async name => {
  if(name === DEFAULT_STYLESHEET) return [{ code: 403, msg: 'The default email stylesheet cannot be deleted' }, null];
  try {
    return await db.transaction(async tx => {
      await tx.delete(emailTemplateStyle).where(eq(emailTemplateStyle.stylesheet, name));
      const [row] = await tx.delete(emailStylesheet).where(eq(emailStylesheet.name, name)).returning({ name: emailStylesheet.name });
      return row ? [null, { name }] : [{ code: 404, msg: 'That email stylesheet does not exist' }, null];
    });
  } catch(error) {
    return [{ code: 500, msg: 'The stylesheet could not be deleted' }, null];
  }
};

/* The stylesheet a template uses: its choice, or the default. */
export const stylesheetFor = async template => {
  try {
    const [row] = await db.select({ stylesheet: emailTemplateStyle.stylesheet }).from(emailTemplateStyle).where(eq(emailTemplateStyle.template, template)).limit(1);
    return row?.stylesheet ?? DEFAULT_STYLESHEET;
  } catch(error) {
    return DEFAULT_STYLESHEET;
  }
};

/* Every template that has a choice, as { template: stylesheet }. Templates not listed use the default. */
export const stylesheetChoices = async () => {
  try {
    const rows = await db.select().from(emailTemplateStyle);
    return Object.fromEntries(rows.map(row => [row.template, row.stylesheet]));
  } catch(error) {
    return {};
  }
};

export const setStylesheetFor = async (template, stylesheet) => {
  if(typeof template !== 'string' || !template) return [{ code: 400, msg: 'Template name is required' }, null];
  const [exists] = await db.select({ name: emailStylesheet.name }).from(emailStylesheet).where(eq(emailStylesheet.name, stylesheet)).limit(1);
  if(!exists && stylesheet !== DEFAULT_STYLESHEET) return [{ code: 404, msg: 'That email stylesheet does not exist' }, null];
  try {
    if(stylesheet === DEFAULT_STYLESHEET){
      await db.delete(emailTemplateStyle).where(eq(emailTemplateStyle.template, template));
      return [null, { template, stylesheet }];
    }
    const now = new Date();
    await db.insert(emailTemplateStyle).values({ template, stylesheet, updatedAt: now })
      .onConflictDoUpdate({ target: emailTemplateStyle.template, set: { stylesheet, updatedAt: now } });
    return [null, { template, stylesheet }];
  } catch(error) {
    return [{ code: 500, msg: 'The stylesheet could not be chosen for this email' }, null];
  }
};

